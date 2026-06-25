import { Button } from "@/components/ui/button"
import { TsIcon } from "../icon"

export const TsIconButton = (props: any) => {
  const { name, onClick, label, ...rest } = props;
  return (
    <Button variant="ghost" size="icon" onClick={onClick} aria-label={label} {...rest}>
      <TsIcon name={name} />
    </Button>
  );
};
