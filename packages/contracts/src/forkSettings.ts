import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const FORK_CHAT_SETTINGS_FIELDS = {
  showUsageLimitsBar: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
};

export const FORK_CHAT_SETTINGS_PATCH_FIELDS = {
  showUsageLimitsBar: Schema.optionalKey(Schema.Boolean),
};
