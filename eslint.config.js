import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const officialFiles = [
  "src/App.tsx",
  "src/main.tsx",
  "src/components/AppSidebar.tsx",
  "src/components/Layout.tsx",
  "src/components/AdminRoute.tsx",
  "src/components/ProtectedRoute.tsx",
  "src/hooks/useAuth.tsx",
  "src/hooks/useUserRole.tsx",
  "src/hooks/useScrollRestoration.tsx",
  "src/lib/menuData.ts",
  "src/pages/Auth.tsx",
  "src/pages/ResetPassword.tsx",
  "src/pages/PrivacyPolicy.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/Historico.tsx",
  "src/pages/AssistenteIA.tsx",
  "src/pages/AgentesIA.tsx",
  "src/pages/AgenteChatPage.tsx",
  "src/pages/Especialistas.tsx",
  "src/pages/CorretorPortugues.tsx",
  "src/pages/Casos.tsx",
  "src/pages/Profile.tsx",
  "src/pages/Admin.tsx",
  "src/pages/NotFound.tsx",
];

export default tseslint.config(
  { ignores: ["dist", "supabase/functions"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: officialFiles,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
