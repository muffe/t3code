import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const FORK_DESKTOP_SETTINGS_FIELDS = {
  // Other clients persist these values for settings portability but do not act on them.
  desktopNotificationsEnabled: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
  ),
  desktopAttentionBadgeEnabled: Schema.Boolean.pipe(
    Schema.withDecodingDefault(Effect.succeed(false)),
  ),
};

export const FORK_CHAT_SETTINGS_FIELDS = {
  showUsageLimitsBar: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
};

export const FORK_DESKTOP_SETTINGS_PATCH_FIELDS = {
  desktopNotificationsEnabled: Schema.optionalKey(Schema.Boolean),
  desktopAttentionBadgeEnabled: Schema.optionalKey(Schema.Boolean),
};

export const FORK_CHAT_SETTINGS_PATCH_FIELDS = {
  showUsageLimitsBar: Schema.optionalKey(Schema.Boolean),
};
