import { renderBrandIcon } from "@/components/shared/brand-icon";

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  if (size === "maskable") return renderBrandIcon(512, true);
  if (size === "192") return renderBrandIcon(192);
  return renderBrandIcon(512);
}
