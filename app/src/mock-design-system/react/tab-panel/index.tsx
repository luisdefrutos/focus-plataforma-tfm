import { TabsContent } from "@/components/ui/tabs"

export const TsTabPanel = (props: any) => {
  const { value, name, children, ...rest } = props;
  const val = value || name;
  return <TabsContent value={val} {...rest}>{children}</TabsContent>;
};
