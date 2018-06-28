import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './HistoryMenu.styl'
import _ from 'lodash'
import i18n from 'browser/lib/i18n'

class HistoryMenu extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isActive: false
    }
  }

  render () {
    const { direction } = this.props

    return (
      <button className='historyMenu'
        styleName='control-HistoryMenu'
        onClick={this.props.onClick}>
        
        <span styleName='tooltip'>{i18n.__('History')}</span>
      </button>
    )
  }
}

HistoryMenu.propTypes = {
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  direction: PropTypes.string
}

export default CSSModules(HistoryMenu, styles)
