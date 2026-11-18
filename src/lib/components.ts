import "server-only";
import { env } from "./env";

/**
 * Helpers for Discord Components V2 messages.
 * Docs: https://discord.com/developers/docs/components/reference
 *  - flag IS_COMPONENTS_V2 (1 << 15) is required, and `content`/`embeds` cannot be used
 *  - all Text Display content together must stay under 4000 characters
 */

export const IS_COMPONENTS_V2 = 1 << 15;

export type Component = Record<string, unknown>;

export const text = (content: string): Component => ({ type: 10, content });
export const divider = (big = false): Component => ({ type: 14, divider: true, spacing: big ? 2 : 1 });
export const section = (content: string, thumbUrl: string): Component => ({
  type: 9,
  components: [text(content)],
  accessory: { type: 11, media: { url: thumbUrl } },
});
/** The Georgia State Patrol banner (public/images/gsp-banner.jpg), shown at the top of every message. */
export const banner = (): Component => ({
  type: 12,
  items: [{ media: { url: `${env.baseUrl}/images/gsp-banner.jpg` }, description: "Georgia State Patrol" }],
});

/**
 * A Components V2 container (no side colour). Gets the GSP banner at the top unless `withBanner` is false.
 */
export const container = (components: Component[], withBanner = true): Component => ({
  type: 17,
  components: withBanner ? [banner(), ...components] : components,
});
/** A file attached to the same message (Components V2 File component). */
export const fileComponent = (name: string): Component => ({ type: 13, file: { url: `attachment://${name}` } });

export const buttonRow = (buttons: { id: string; label: string; style: 1 | 2 | 3 | 4; emoji?: string }[]): Component => ({
  type: 1,
  components: buttons.map((b) => ({
    type: 2,
    style: b.style,
    label: b.label,
    custom_id: b.id,
    ...(b.emoji ? { emoji: { name: b.emoji } } : {}),
  })),
});

/** Stops user input from pinging anyone or breaking formatting. */
export function clean(s: string | null | undefined, max = 400) {
  let v = (s ?? "").replace(/@(everyone|here)/gi, "@​$1").replace(/<@[&!]?\d+>/g, "[mention]").trim();
  if (!v) return "_Not provided_";
  if (v.length > max) v = v.slice(0, max - 1).trimEnd() + "…";
  return v;
}

export const quote = (s: string | null | undefined, max = 400) =>
  clean(s, max)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

export const unix = (d: Date = new Date()) => Math.floor(d.getTime() / 1000);
