import { Checkbox } from "@/components/ui/checkbox"

export const TsCheckbox = (props: any) => {
  const { checked, onTsChange, children, ...rest } = props;
  const handleChange = (checkedState: boolean) => {
    if (onTsChange) {
      onTsChange({ target: { checked: checkedState } });
    }
  };
  return (
    <label className="flex items-center space-x-2 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={handleChange} {...rest} />
      {children && <span className="text-sm font-medium leading-none">{children}</span>}
    </label>
  );
};
