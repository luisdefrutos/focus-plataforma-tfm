import { DropdownMenuLabel, DropdownMenuGroup } from "@/components/ui/dropdown-menu"

export const TsMenuLabel = (props: any) => {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel {...props}>{props.children}</DropdownMenuLabel>
    </DropdownMenuGroup>
  );
};
