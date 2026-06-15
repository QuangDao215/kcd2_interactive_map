// ESLint flat config.  Run:  npx eslint js/
//
// The app is several classic <script> files sharing ONE global scope, so
// no-undef and no-unused-vars are off (functions/state are defined in one file
// and used from another — ESLint can't see across files). We focus on rules
// that catch real bugs regardless of scope — e.g. no-dupe-keys would have
// caught the duplicate icon_map keys we hit.
export default [
  {
    files: ["js/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script" },
    rules: {
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-redeclare": "error",
      "no-unreachable": "warn",
      "no-cond-assign": ["error", "always"],
      "no-self-assign": "error",
      "no-self-compare": "warn",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-constant-condition": ["warn", { "checkLoops": false }],
    },
  },
];
