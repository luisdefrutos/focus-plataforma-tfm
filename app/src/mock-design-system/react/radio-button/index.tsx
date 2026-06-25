import React from 'react'

export const TsRadioButton = (props: any) => {
  const { value, children, selectedValue, onChange, ...rest } = props;
  const isSelected = value === selectedValue;
  
  return (
    <button
      type="button"
      onClick={() => onChange && onChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${isSelected ? 'bg-[#005696] text-white shadow-sm' : 'hover:bg-background/50 hover:text-foreground'}`}
      {...rest}
    >
      {children}
    </button>
  );
};
