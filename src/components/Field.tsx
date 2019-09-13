import React from 'react';


export function Field({ title, children }) {
  return (<label className="field">
    <span className="field__title">
      {title}
    </span>
    {children}
  </label>);
}
