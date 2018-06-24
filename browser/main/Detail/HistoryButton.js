import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './HistoryButton.styl'
import _ from 'lodash'
import i18n from 'browser/lib/i18n'

class HistoryButton extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isActive: false
    }
  }

  render () {
    const { direction } = this.props

    return (
      <button className='HistoryButton'
        styleName='control-historyButton'
        onClick={this.props.onClick}>
        <img styleName='icon'
          src={this.props.isActive
            ? '../resources/icon/' + direction + '-dark.svg'
            : '../resources/icon/' + direction + '-green.svg'
          }
        />
        <span styleName='tooltip'>{i18n.__('History')}</span>
      </button>
    )
  }
}

HistoryButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  direction: PropTypes.string
}

export default CSSModules(HistoryButton, styles)
