import React from 'react'
import { RadioGroup } from "@/components/ui/radio-group"

export const TsRadioGroup = (props: any) => {
  const { value, onTsChange, children, size, ...rest } = props;
  
  const handleChange = (val: string) => {
    if (onTsChange) onTsChange({ target: { value: val } });
  };
  
  // Clonamos los hijos para pasarles el value actual y el onChange
  const items = React.Children.map(children, (child: any) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        selectedValue: value,
        onChange: handleChange,
      });
    }
    return child;
  });

  return (
    <div className="inline-flex h-9 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground" {...rest}>
      {items}
    </div>
  );
};
