import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './MarkdownNoteDetail.styl'
import MarkdownEditor from 'browser/components/MarkdownEditor'
import MarkdownSplitEditor from 'browser/components/MarkdownSplitEditor'
import TodoListPercentage from 'browser/components/TodoListPercentage'
import StarButton from './StarButton'
import TagSelect from './TagSelect'
import FolderSelect from './FolderSelect'
import dataApi from 'browser/main/lib/dataApi'
import { hashHistory } from 'react-router'
import ee from 'browser/main/lib/eventEmitter'
import markdown from 'browser/lib/markdownTextHelper'
import StatusBar from '../StatusBar'
import _ from 'lodash'
import { findNoteTitle } from 'browser/lib/findNoteTitle'
import AwsMobileAnalyticsConfig from 'browser/main/lib/AwsMobileAnalyticsConfig'
import ConfigManager from 'browser/main/lib/ConfigManager'
import TrashButton from './TrashButton'
import FullscreenButton from './FullscreenButton'
import RestoreButton from './RestoreButton'
import PermanentDeleteButton from './PermanentDeleteButton'
import InfoButton from './InfoButton'
import ToggleModeButton from './ToggleModeButton'
import InfoPanel from './InfoPanel'
import InfoPanelTrashed from './InfoPanelTrashed'
import { formatDate } from 'browser/lib/date-formatter'
import { getTodoPercentageOfCompleted } from 'browser/lib/getTodoStatus'
import striptags from 'striptags'
import { confirmDeleteNote } from 'browser/lib/confirmDeleteNote'
import markdownToc from 'browser/lib/markdown-toc-generator'
import store from 'browser/main/store'
import HistoryButton from './HistoryButton'
import i18n from 'browser/lib/i18n'

class MarkdownNoteDetail extends React.Component {
  constructor (props) {
    super(props)
    this.props.data.backStacks.present = {title: this.props.note.title, hash: this.props.note.key}
    this.state = {
      isMovingNote: false,
      note: Object.assign({
        title: '',
        content: '',
        linesHighlighted: []
      }, props.note),
      isLockButtonShown: props.config.editor.type !== 'SPLIT',
      isLocked: false,
      editorType: props.config.editor.type,
      switchPreview: props.config.editor.switchPreview,
      backStack: this.props.data.backStacks,
      isBackActive: false,
      isForwardActive: false,
      history: []
    }

    this.dispatchTimer = null
    this.toggleLockButton = this.handleToggleLockButton.bind(this)
    this.generateToc = () => this.handleGenerateToc()
  }

  focus () {
    this.refs.content.focus()
  }

  componentDidMount () {
    this.setState({
      backStack: this.undoable('Default')
    })
    this.historyChecks()
    ee.on('topbar:togglelockbutton', this.toggleLockButton)
    ee.on('topbar:togglemodebutton', () => {
      const reversedType = this.state.editorType === 'SPLIT' ? 'EDITOR_PREVIEW' : 'SPLIT'
      this.handleSwitchMode(reversedType)
    })
    ee.on('hotkey:deletenote', this.handleDeleteNote.bind(this))
    ee.on('code:generate-toc', this.generateToc)

    // Focus content if using blur or double click
    if (this.state.switchPreview === 'BLUR' || this.state.switchPreview === 'DBL_CLICK') this.focus()
  }

  componentWillReceiveProps (nextProps) {
    const isNewNote = nextProps.note.key !== this.props.note.key
    const hasDeletedTags = nextProps.note.tags.length < this.props.note.tags.length
    if (!this.state.isMovingNote && (isNewNote || hasDeletedTags)) {
      if (this.saveQueue != null) this.saveNow()
      this.setState({
        note: Object.assign({linesHighlighted: []}, nextProps.note)
      }, () => {
        this.refs.content.reload()
        this.setState({
          backStack: this.undoable('Default')
        })
        this.historyChecks()
        if (this.refs.tags) this.refs.tags.reset()
      })
    }
  }

  componentWillUnmount () {
    store.dispatch({
      type: 'BACKSTACK_UPDATE',
      backStacks: this.state.backStack
    })
    ee.off('topbar:togglelockbutton', this.toggleLockButton)
    ee.off('code:generate-toc', this.generateToc)
    if (this.saveQueue != null) this.saveNow()
  }

  handleUpdateTag () {
    const { note } = this.state
    if (this.refs.tags) note.tags = this.refs.tags.value
    this.updateNote(note)
  }

  handleUpdateContent () {
    const { note } = this.state
    note.content = this.refs.content.value
    note.title = markdown.strip(striptags(findNoteTitle(note.content, this.props.config.editor.enableFrontMatterTitle, this.props.config.editor.frontMatterTitleField)))
    this.updateNote(note)
  }

  historyChecks () {
    var back = this.state.backStack
    var unique = []
    var historyNow = []
    // var pobj = {title: this.state.note.title, hash: this.state.note.key}
    // unique.push(pobj.hash) && historyNow.push(pobj)
    back.past.forEach(function (obj) {
      unique.indexOf(obj.hash) === -1 && unique.push(obj.hash) && historyNow.push(obj)
    })
    back.future.forEach(function (obj) {
      unique.indexOf(obj.hash) === -1 && unique.push(obj.hash) && historyNow.push(obj)
    })
    this.setState({
      history: historyNow
    })
    if (back.past.length > 10) {
      back.past.splice(0, 1)
      this.setState({
        backStack: back
      })
    }
    if (back.future.length > 10) {
      back.future.splice(0, 1)
      this.setState({ backStack: back })
    }
    if (back.past.length) {
      if (!this.state.isBackActive) {
        this.setState({ isBackActive: true })
      }
    } else {
      if (this.state.isBackActive) {
        this.setState({ isBackActive: false })
      }
    }
    if (back.future.length) {
      if (!this.state.isForwardActive) {
        this.setState({ isForwardActive: true })
      }
    } else {
      if (this.state.isForwardActive) {
        this.setState({ isForwardActive: false })
      }
    }
    console.log(this.state.backStack)
    console.log(this.state.history)
  }

  handleBackwardButtonClick () {
    this.setState({
      backStack: this.undoable('BACKWARD')
    })
  }

  handleForwardButtonClick () {
    this.setState({
      backStack: this.undoable('FORWARD')
    })
  }

  undoable (action) {
    // this.historyChecks()
    var { past, present, future } = this.state.backStack
    switch (action) {
      case 'BACKWARD':
        console.log('Backward')
        if (past.length) {
          var previous = past.pop()
          if (previous.hash === present.hash) {
            previous = past.pop()
          }
          const newPast = past
          ee.emit('list:jump', previous.hash)
          return {
            past: newPast,
            present: previous,
            future: [...future, present]
          }
        }
        break
      case 'FORWARD':
        console.log('Forward')
        if (future.length) {
          var next = future.pop()
          if (next.hash === present.hash) {
            next = future.pop()
          }
          const newFuture = future
          ee.emit('list:jump', next.hash)
          return {
            past: [...past, present],
            present: next,
            future: newFuture
          }
        }
        break
      case 'Default':
        console.log('Default')
        const newPresent = {title: this.state.note.title, hash: this.state.note.key}
        if (present.hash === newPresent.hash) {
          return {
            past: past,
            present: newPresent,
            future: future
          }
        }
        return {
          past: [...past, present],
          present: newPresent,
          future: future
        }
    }
    return {
      past: past,
      present: present,
      future: future
    }
  }

  updateNote (note) {
    note.updatedAt = new Date()
    this.setState({note}, () => {
      this.save()
    })
  }

  save () {
    clearTimeout(this.saveQueue)
    this.saveQueue = setTimeout(() => {
      this.saveNow()
    }, 1000)
  }

  saveNow () {
    const { note, dispatch } = this.props
    clearTimeout(this.saveQueue)
    this.saveQueue = null

    dataApi
      .updateNote(note.storage, note.key, this.state.note)
      .then((note) => {
        dispatch({
          type: 'UPDATE_NOTE',
          note: note
        })
        AwsMobileAnalyticsConfig.recordDynamicCustomEvent('EDIT_NOTE')
      })
  }

  handleFolderChange (e) {
    const { note } = this.state
    const value = this.refs.folder.value
    const splitted = value.split('-')
    const newStorageKey = splitted.shift()
    const newFolderKey = splitted.shift()

    dataApi
      .moveNote(note.storage, note.key, newStorageKey, newFolderKey)
      .then((newNote) => {
        this.setState({
          isMovingNote: true,
          note: Object.assign({}, newNote)
        }, () => {
          const { dispatch, location } = this.props
          dispatch({
            type: 'MOVE_NOTE',
            originNote: note,
            note: newNote
          })
          hashHistory.replace({
            pathname: location.pathname,
            query: {
              key: newNote.key
            }
          })
          this.setState({
            isMovingNote: false
          })
        })
      })
  }

  handleStarButtonClick (e) {
    const { note } = this.state
    if (!note.isStarred) AwsMobileAnalyticsConfig.recordDynamicCustomEvent('ADD_STAR')

    note.isStarred = !note.isStarred

    this.setState({
      note
    }, () => {
      this.save()
    })
  }

  exportAsFile () {

  }

  exportAsMd () {
    ee.emit('export:save-md')
  }

  exportAsTxt () {
    ee.emit('export:save-text')
  }

  exportAsHtml () {
    ee.emit('export:save-html')
  }

  handleKeyDown (e) {
    switch (e.keyCode) {
      // tab key
      case 9:
        if (e.ctrlKey && !e.shiftKey) {
          e.preventDefault()
          this.jumpNextTab()
        } else if (e.ctrlKey && e.shiftKey) {
          e.preventDefault()
          this.jumpPrevTab()
        } else if (!e.ctrlKey && !e.shiftKey && e.target === this.refs.description) {
          e.preventDefault()
          this.focusEditor()
        }
        break
      // I key
      case 73:
        {
          const isSuper = global.process.platform === 'darwin'
            ? e.metaKey
            : e.ctrlKey
          if (isSuper) {
            e.preventDefault()
            this.handleInfoButtonClick(e)
          }
        }
        break
    }
  }

  handleTrashButtonClick (e) {
    const { note } = this.state
    const { isTrashed } = note
    const { confirmDeletion } = this.props.config.ui

    if (isTrashed) {
      if (confirmDeleteNote(confirmDeletion, true)) {
        const {note, dispatch} = this.props
        dataApi
          .deleteNote(note.storage, note.key)
          .then((data) => {
            const dispatchHandler = () => {
              dispatch({
                type: 'DELETE_NOTE',
                storageKey: data.storageKey,
                noteKey: data.noteKey
              })
            }
            ee.once('list:next', dispatchHandler)
          })
          .then(() => ee.emit('list:next'))
      }
    } else {
      if (confirmDeleteNote(confirmDeletion, false)) {
        note.isTrashed = true

        this.setState({
          note
        }, () => {
          this.save()
        })

        ee.emit('list:next')
      }
    }
  }

  handleRestoreButtonClick (e) {
    const { note } = this.state

    note.isTrashed = false

    this.setState({
      note
    }, () => {
      this.save()
      this.refs.content.reload()
      ee.emit('list:next')
    })
  }

  handleFullScreenButton (e) {
    ee.emit('editor:fullscreen')
  }

  handleLockButtonMouseDown (e) {
    e.preventDefault()
    ee.emit('editor:lock')
    this.setState({ isLocked: !this.state.isLocked })
    if (this.state.isLocked) this.focus()
  }

  getToggleLockButton () {
    return this.state.isLocked ? '../resources/icon/icon-previewoff-on.svg' : '../resources/icon/icon-previewoff-off.svg'
  }

  handleDeleteKeyDown (e) {
    if (e.keyCode === 27) this.handleDeleteCancelButtonClick(e)
  }

  handleToggleLockButton (event, noteStatus) {
    // first argument event is not used
    if (noteStatus === 'CODE') {
      this.setState({isLockButtonShown: true})
    } else {
      this.setState({isLockButtonShown: false})
    }
  }

  handleGenerateToc () {
    const editor = this.refs.content.refs.code.editor
    markdownToc.generateInEditor(editor)
  }

  handleFocus (e) {
    this.focus()
  }

  handleInfoButtonClick (e) {
    const infoPanel = document.querySelector('.infoPanel')
    if (infoPanel.style) infoPanel.style.display = infoPanel.style.display === 'none' ? 'inline' : 'none'
  }

  handleHistButtonClick (e) {
    const historyMenu = document.querySelector('.historymenu')
    if (historyMenu.style) historyMenu.style.display = historyMenu.style.display === 'none' ? 'inline' : 'none'
  }

  handleHistMenuClick (e, note) {
    const historyMenu = document.querySelector('.historymenu')
    if (historyMenu.style) historyMenu.style.display = historyMenu.style.display === 'none' ? 'inline' : 'none'
    ee.emit('list:jump', note.hash)
  }

  print (e) {
    ee.emit('print')
  }

  handleSwitchMode (type) {
    // If in split mode, hide the lock button
    this.setState({ editorType: type, isLockButtonShown: !(type === 'SPLIT') }, () => {
      this.focus()
      const newConfig = Object.assign({}, this.props.config)
      newConfig.editor.type = type
      ConfigManager.set(newConfig)
    })
  }

  handleDeleteNote () {
    this.handleTrashButtonClick()
  }

  handleClearTodo () {
    const { note } = this.state
    const splitted = note.content.split('\n')

    const clearTodoContent = splitted.map((line) => {
      const trimmedLine = line.trim()
      if (trimmedLine.match(/\[x\]/i)) {
        return line.replace(/\[x\]/i, '[ ]')
      } else {
        return line
      }
    }).join('\n')

    note.content = clearTodoContent
    this.refs.content.setValue(note.content)

    this.updateNote(note)
  }

  renderEditor () {
    const { config, ignorePreviewPointerEvents } = this.props
    const { note } = this.state

    if (this.state.editorType === 'EDITOR_PREVIEW') {
      return <MarkdownEditor
        ref='content'
        styleName='body-noteEditor'
        config={config}
        value={note.content}
        storageKey={note.storage}
        noteKey={note.key}
        linesHighlighted={note.linesHighlighted}
        onChange={this.handleUpdateContent.bind(this)}
        isLocked={this.state.isLocked}
        ignorePreviewPointerEvents={ignorePreviewPointerEvents}
      />
    } else {
      return <MarkdownSplitEditor
        ref='content'
        config={config}
        value={note.content}
        storageKey={note.storage}
        noteKey={note.key}
        linesHighlighted={note.linesHighlighted}
        onChange={this.handleUpdateContent.bind(this)}
        ignorePreviewPointerEvents={ignorePreviewPointerEvents}
      />
    }
  }

  renderHistory () {
    return <div>
      <button
        className='historyButton'
        styleName='control-historyButton'
        onClick={(e) => this.handleHistButtonClick(e)}>
        <img styleName='icon'
          src={this.state.backStack.past.length || this.state.backStack.future.length
        ? '../resources/icon/history-green.svg' : '../resources/icon/history-dark.svg'}
      />
        <span styleName='tooltip'>{i18n.__('Show History')}</span>
      </button>
      <div className='historymenu' style={{display: 'none', cursor: 'pointer'}} styleName='control-historyMenu'>
        <div>
          {(() => {
            if (!this.state.backStack.past.length && !this.state.backStack.future.length) {
              return (
                <div><p>No History</p></div>
              )
            } else {
              return (
                this.state.history.map(x =>
                  <div key={x.hash}>
                    <p styleName={this.state.note.key === x.hash
                      ? 'control-activeMenuButton' : 'control-menuButton'}
                      onClick={(e) => this.handleHistMenuClick(e, x)}>{x.title === ''
                      ? 'Empty Note' : x.title }
                    </p>
                    <hr />
                  </div>)
              )
            }
          })()}
        </div>
      </div>
    </div>
  }

  render () {
    const { data, location, config } = this.props
    const { note, editorType } = this.state
    const storageKey = note.storage
    const folderKey = note.folder

    const options = []
    data.storageMap.forEach((storage, index) => {
      storage.folders.forEach((folder) => {
        options.push({
          storage: storage,
          folder: folder
        })
      })
    })
    const currentOption = options.filter((option) => option.storage.key === storageKey && option.folder.key === folderKey)[0]
    const trashTopBar = <div styleName='info'>
      <div styleName='info-left'>
        <RestoreButton onClick={(e) => this.handleRestoreButtonClick(e)} />
      </div>
      <div styleName='info-right'>
        <PermanentDeleteButton onClick={(e) => this.handleTrashButtonClick(e)} />
        <InfoButton
          onClick={(e) => this.handleInfoButtonClick(e)}
        />
        <InfoPanelTrashed
          storageName={currentOption.storage.name}
          folderName={currentOption.folder.name}
          updatedAt={formatDate(note.updatedAt)}
          createdAt={formatDate(note.createdAt)}
          exportAsHtml={this.exportAsHtml}
          exportAsMd={this.exportAsMd}
          exportAsTxt={this.exportAsTxt}
        />
      </div>
    </div>
    const detailTopBar = <div styleName='info'>
      <div styleName='info-left'>
        <div styleName='info-left-top'>
          <FolderSelect styleName='info-left-top-folderSelect'
            value={this.state.note.storage + '-' + this.state.note.folder}
            ref='folder'
            data={data}
            onChange={(e) => this.handleFolderChange(e)}
          />
        </div>
        <TagSelect
          ref='tags'
          value={this.state.note.tags}
          saveTagsAlphabetically={config.ui.saveTagsAlphabetically}
          showTagsAlphabetically={config.ui.showTagsAlphabetically}
          data={data}
          onChange={this.handleUpdateTag.bind(this)}
          coloredTags={config.coloredTags}
        />
        <TodoListPercentage onClearCheckboxClick={(e) => this.handleClearTodo(e)} percentageOfTodo={getTodoPercentageOfCompleted(note.content)} />
      </div>
      <div styleName='info-right' >
        <HistoryButton
          onClick={(e) => this.handleBackwardButtonClick(e)}
          svg_src={this.state.isBackActive
              ? '../resources/icon/left-green.svg'
              : '../resources/icon/left-dark.svg'}
          tooltip='Backward'
          />
        {this.renderHistory()}
        <HistoryButton
          onClick={(e) => this.handleForwardButtonClick(e)}
          svg_src={this.state.isForwardActive
                ? '../resources/icon/right-green.svg'
                : '../resources/icon/right-dark.svg'}
          tooltip='Forward'
        />
        <ToggleModeButton onClick={(e) => this.handleSwitchMode(e)} editorType={editorType} />
        <StarButton
          onClick={(e) => this.handleStarButtonClick(e)}
          isActive={note.isStarred}
        />

        {(() => {
          const imgSrc = `${this.getToggleLockButton()}`
          const lockButtonComponent =
            <button styleName='control-lockButton'
              onFocus={(e) => this.handleFocus(e)}
              onMouseDown={(e) => this.handleLockButtonMouseDown(e)}
            >
              <img styleName='iconInfo' src={imgSrc} />
              {this.state.isLocked ? <span styleName='tooltip'>Unlock</span> : <span styleName='tooltip'>Lock</span>}
            </button>

          return (
            this.state.isLockButtonShown ? lockButtonComponent : ''
          )
        })()}

        <FullscreenButton onClick={(e) => this.handleFullScreenButton(e)} />

        <TrashButton onClick={(e) => this.handleTrashButtonClick(e)} />

        <InfoButton
          onClick={(e) => this.handleInfoButtonClick(e)}
        />

        <InfoPanel
          storageName={currentOption.storage.name}
          folderName={currentOption.folder.name}
          noteLink={`[${note.title}](:note:${location.query.key})`}
          updatedAt={formatDate(note.updatedAt)}
          createdAt={formatDate(note.createdAt)}
          exportAsMd={this.exportAsMd}
          exportAsTxt={this.exportAsTxt}
          exportAsHtml={this.exportAsHtml}
          wordCount={note.content.split(' ').length}
          letterCount={note.content.replace(/\r?\n/g, '').length}
          type={note.type}
          print={this.print}
        />
      </div>
    </div>

    return (
      <div className='NoteDetail'
        style={this.props.style}
        styleName='root'
        onKeyDown={(e) => this.handleKeyDown(e)}
      >

        {location.pathname === '/trashed' ? trashTopBar : detailTopBar}

        <div styleName='body'>
          {this.renderEditor()}
        </div>

        <StatusBar
          {..._.pick(this.props, ['config', 'location', 'dispatch'])}
          date={note.updatedAt}
        />
      </div>
    )
  }
}

MarkdownNoteDetail.propTypes = {
  dispatch: PropTypes.func,
  repositories: PropTypes.array,
  note: PropTypes.shape({

  }),
  style: PropTypes.shape({
    left: PropTypes.number
  }),
  ignorePreviewPointerEvents: PropTypes.bool
}

export default CSSModules(MarkdownNoteDetail, styles)
