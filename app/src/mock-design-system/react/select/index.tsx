import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, X } from "lucide-react"
import React from 'react'

export const TsSelect = (props: any) => {
  const { children, value, onTsChange, placeholder, label, multiple, clearable, ...rest } = props;
  
  const options = React.Children.toArray(children).map((child: any) => ({
    value: child.props?.value,
    label: child.props?.children
  }));

  const handleMultiChange = (optValue: string, checked: boolean) => {
    const current = Array.isArray(value) ? value : (value ? [value] : []);
    const next = checked ? [...current, optValue] : current.filter(v => v !== optValue);
    if (onTsChange) {
      onTsChange({ target: { value: next } });
    }
  };

  const handleSingleChange = (optValue: string) => {
    if (onTsChange) {
      onTsChange({ target: { value: optValue } });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTsChange) {
      onTsChange({ target: { value: multiple ? [] : '' } });
    }
  };

  const hasValue = multiple ? (Array.isArray(value) && value.length > 0) : !!value;
  const displayValue = multiple 
    ? (Array.isArray(value) && value.length > 0 ? `${value.length} seleccionados` : placeholder)
    : (options.find(o => o.value === value)?.label || placeholder);

  // Fallback to div if DropdownMenuTrigger wraps our button to avoid hydration error
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium leading-none">{label}</label>}
      <DropdownMenu>
        <DropdownMenuTrigger className={`flex h-10 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${!hasValue ? 'text-muted-foreground' : ''}`}>
          <span className="truncate">{displayValue}</span>
          <div className="flex items-center gap-1">
            {clearable && hasValue && (
              <div onClick={handleClear} className="hover:bg-muted p-0.5 rounded-full z-10">
                <X className="h-3 w-3" />
              </div>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
          {multiple ? (
            options.map((opt) => {
              const isChecked = Array.isArray(value) && value.includes(opt.value);
              return (
                <DropdownMenuCheckboxItem 
                  key={opt.value} 
                  checked={isChecked} 
                  onCheckedChange={(checked) => handleMultiChange(opt.value, checked)}
                >
                  {opt.label}
                </DropdownMenuCheckboxItem>
              );
            })
          ) : (
            <DropdownMenuRadioGroup value={value} onValueChange={handleSingleChange}>
              {options.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
