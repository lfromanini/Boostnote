import PropTypes from 'prop-types'
import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './HistoryButton2.styl'
import _ from 'lodash'
import i18n from 'browser/lib/i18n'

class HistoryButton2 extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      isActive: false
    }
  }

  render () {
    const { direction } = this.props
    return (
      <button className='HistoryButton2'
        styleName='control-historyButton2'
        onClick={this.props.onClick}>
        <img styleName='icon'
          src={this.props.isActive
            ? '../resources/icon/' + direction + '-green.svg'
            : '../resources/icon/' + direction + '-dark.svg'
          }
        />
        <span styleName='tooltip'>{i18n.__('History')}</span>
      </button>
    )
  }
}

HistoryButton2.propTypes = {
  onClick: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  direction: PropTypes.string
}

export default CSSModules(HistoryButton2, styles)
