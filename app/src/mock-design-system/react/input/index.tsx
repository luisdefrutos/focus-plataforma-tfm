import { Input } from "@/components/ui/input"
import React, { useRef } from 'react'
import { X } from 'lucide-react'

export const TsInput = (props: any) => {
  const { children, onTsInput, onTsClear, onTsFocus, className, label, clearable, value, ...rest } = props;
  const childrenArray = React.Children.toArray(children);
  const prefixNodes = childrenArray.filter((c: any) => c?.props?.slot === 'prefix');
  const suffixNodes = childrenArray.filter((c: any) => c?.props?.slot === 'suffix');
  const hasPrefix = prefixNodes.length > 0;
  const hasSuffix = suffixNodes.length > 0;

  const handleChange = (e: any) => {
    if (onTsInput) {
      onTsInput({ target: e.target });
    }
  };

  const handleClear = () => {
    if (onTsClear) onTsClear();
    if (onTsInput) onTsInput({ target: { value: '' } });
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className || ''}`}>
      {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>}
      <div className="relative flex items-center w-full">
        {hasPrefix && (
          <div className="absolute left-3 text-muted-foreground flex items-center justify-center pointer-events-none">
            {prefixNodes}
          </div>
        )}
        <Input 
          onChange={handleChange} 
          onFocus={onTsFocus}
          value={value}
          className={`h-10 text-sm ${hasPrefix ? "pl-10" : ""} ${(hasSuffix || clearable) ? "pr-10" : ""}`} 
          {...rest} 
        />
        {(hasSuffix || (clearable && value)) && (
          <div className="absolute right-3 flex items-center gap-1">
            {clearable && value && (
              <button 
                type="button" 
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {hasSuffix && (
              <span className="text-muted-foreground pointer-events-none">
                {suffixNodes}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
