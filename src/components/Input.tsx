import React, { useEffect, useState } from 'react';
export function Input({ value, onChange, ...restProps }) {
  const [_value, setValue] = useState(value);
  useEffect(() => {
    setValue(value);
  }, [value]);
  return (<input value={_value} onChange={event => setValue(event.target.value)} onBlur={() => onChange(_value)} onKeyDown={event => event.keyCode === 13 && onChange(_value)} style={{
    flex: 1,
  }} {...restProps} />);
}
