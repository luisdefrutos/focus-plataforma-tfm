import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export const TsMenuItem = (props: any) => {
  const { children, onClick, ...rest } = props;
  return (
    <DropdownMenuItem onClick={onClick} className="cursor-pointer flex items-center gap-2" {...rest}>
      {children}
    </DropdownMenuItem>
  );
};
