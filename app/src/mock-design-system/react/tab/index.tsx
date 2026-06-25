import { TabsTrigger } from "@/components/ui/tabs"

export const TsTab = (props: any) => {
  const { value, panel, children, ...rest } = props;
  const val = value || panel;
  return <TabsTrigger value={val} {...rest}>{children}</TabsTrigger>;
};
