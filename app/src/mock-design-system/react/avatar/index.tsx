import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export const TsAvatar = (props: any) => {
  const { initials, label, ...rest } = props;
  return (
    <Avatar {...rest}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
};
