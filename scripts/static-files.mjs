// Exact public payload. Never recursively copy src/: it could contain private JSON.
export const staticFiles = [
  'index.html', 'styles.css', 'staticwebapp.config.json',
  'src/app.js', 'src/model.js', 'src/plan.js', 'src/view.js', 'src/wizard-plan.js', 'src/wizard-ui.js', 'src/money-input.js',
];
