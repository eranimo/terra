import React from 'react';


type FieldProps = {
  title?: string,
  desc?: string,
}

export const Field: React.FC<FieldProps> = ({ title, desc, children }) => {
  return (<label className="field" title={desc}>
    {title && <span className="field__title">
      {title}
    </span>}
    {children}
  </label>);
}
