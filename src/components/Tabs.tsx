import React, { useState } from 'react';
import classNames from 'classnames';


export function Tabs({ children }) {
  const tabs = children();
  const firstTab = Object.keys(tabs)[0];
  const [activeTab, setActiveTab] = useState(firstTab);
  return (<div>
    <div className="tab-row">
      {Object.keys(tabs).map(tabID => (<a key={tabID} className={classNames('tab', activeTab === tabID && 'tab--active')} onClick={() => setActiveTab(tabID)}>
        {tabs[tabID].title}
      </a>))}
    </div>
    <div>
      {tabs[activeTab].render()}
    </div>
  </div>);
}
