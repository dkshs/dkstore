import { dkshs } from "@dkshs/eslint-config";

export default dkshs(
  {},
  {
    files: ["src/components/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": ["off"],
    },
  },
);
