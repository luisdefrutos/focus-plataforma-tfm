import { SelectItem } from "@/components/ui/select"

export const TsOption = (props: any) => {
  const { value, children, ...rest } = props;
  return (
    <SelectItem value={value} {...rest}>
      {children}
    </SelectItem>
  );
};
