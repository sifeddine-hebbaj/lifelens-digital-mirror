export const budgetFr = {
  title: "Budget", subtitle: "Dépenses, revenus, épargne et paiements récurrents, mois par mois.",
  navOverview: "Aperçu", navExpenses: "Mouvements", navRecurring: "Récurrents", navReports: "Rapports", subnav: "Sections du budget",
  prevMonth: "Mois précédent", nextMonth: "Mois suivant", thisMonth: "Ce mois-ci",
  loading: "Chargement…", save: "Enregistrer", saving: "Enregistrement…", cancel: "Annuler", edit: "Modifier", remove: "Supprimer", add: "Ajouter", optional: "facultatif",
  confirmDelete: "Supprimer « {name} » ? Cette action est définitive.", loadError: "Impossible de charger le budget :", saveError: "Enregistrement impossible :", missingTables: "Le schéma Budget n’est pas installé. Appliquez les migrations Supabase avec supabase db push.",
  income: "Revenus", expenses: "Dépenses", net: "Solde net", remaining: "Budget restant", overBy: "Dépassement de {amount}", noBudget: "Aucun budget défini",
  budgetUsed: "{percent} % du budget utilisé", spendingVsBudget: "Dépenses et budget", byCategory: "Par catégorie", noExpensesMonth: "Aucune dépense ce mois-ci.", total: "Total",
  budgetSettings: "Budget du mois", settingsHint: "Ces valeurs s’appliquent à ce mois. Les mois suivants les reprennent tant que vous ne les changez pas.",
  settingsInherited: "Aucun réglage enregistré pour ce mois : les valeurs du mois précédent sont affichées.", monthlyLimit: "Limite de dépenses du mois", annualBudget: "Budget annuel", savingsGoal: "Objectif d’épargne", settingsSaved: "Budget enregistré.", currencyNote: "Devise : {currency}. Modifiable dans le profil.",
  savings: "Épargne", savingsBalance: "Solde de l’épargne", savingsHint: "Le solde est calculé : tous les revenus jusqu’à ce mois, plus vos corrections.", goalProgress: "{percent} % de l’objectif", noGoal: "Aucun objectif défini",
  addToSavings: "Ajouter à l’épargne", correctSavings: "Corriger le total", amountToAdd: "Montant à ajouter", targetBalance: "Nouveau solde", note: "Note", savingsUpdated: "Épargne mise à jour.",
  recentExpenses: "Dernières dépenses", viewAll: "Tout voir", upcoming: "Prochains paiements", noUpcoming: "Aucun paiement à venir.", overdue: "En retard de {days} j", dueToday: "Aujourd’hui", dueIn: "Dans {days} j", markPaid: "Marquer payé", paidDone: "Paiement enregistré, prochaine échéance mise à jour.", addExpense: "Ajouter une dépense",
  expensesTab: "Dépenses", incomeTab: "Revenus", searchPlaceholder: "Rechercher une dépense", allCategories: "Toutes", noResults: "Aucun résultat.", showMore: "Afficher plus",
  editExpense: "Modifier la dépense", saveExpense: "Enregistrer la dépense", name: "Nom", namePlaceholder: "Ex. courses, taxi…", amount: "Montant", category: "Catégorie", date: "Date", source: "Source", sourcePlaceholder: "Ex. salaire, freelance…",
  addIncome: "Ajouter un revenu", incomeHint: "Chaque revenu est automatiquement ajouté à votre épargne.", noIncomeMonth: "Aucun revenu ce mois-ci.", invalidForm: "Vérifiez les champs : montant positif et date valides.",
  expenseAdded: "Dépense ajoutée.", expenseUpdated: "Dépense modifiée.", expenseDeleted: "Dépense supprimée.", incomeAdded: "Revenu ajouté.", incomeDeleted: "Revenu supprimé.",
  recurringTitle: "Paiements récurrents", recurringSubtitle: "Abonnements et factures. Les échéances proches sont signalées ici.", addRecurring: "Ajouter un paiement", editRecurring: "Modifier le paiement", saveRecurring: "Enregistrer le paiement",
  frequency: "Fréquence", monthly: "Mensuel", yearly: "Annuel", nextDue: "Prochaine échéance", remindDays: "Signaler (jours avant)", remindHint: "Le paiement est mis en avant ce nombre de jours avant l’échéance.", emailReminder: "Recevoir un rappel par e-mail", emailReminderHint: "Envoyé à l’adresse de votre compte dans la période définie ci-dessus.", notes: "Notes",
  pause: "Mettre en pause", resume: "Réactiver", paused: "En pause", noRecurring: "Aucun paiement récurrent pour le moment.", monthlyCost: "Coût mensuel moyen", activeCount: "{count} actifs", sendTestEmail: "Envoyer un e-mail de test", sendingTestEmail: "Envoi du test…", emailTestSent: "E-mail accepté par le fournisseur. Vérifiez votre boîte de réception et les indésirables.", emailTestUnavailable: "Service de messagerie temporairement indisponible.", emailTestEmailNotConfigured: "Configurez SMTP ou Resend avant d’envoyer un test.", emailTestMigrationMissing: "Appliquez la migration Supabase des rappels Budget avant le test.", emailTestCooldown: "Attendez une minute avant un nouvel e-mail de test.", emailTestFailed: "Impossible d’envoyer l’e-mail de test.",
  recurringAdded: "Paiement ajouté.", recurringUpdated: "Paiement modifié.", recurringDeleted: "Paiement supprimé.", every: "{frequency} · {date}",
  reportsTitle: "Rapports", reportsSubtitle: "Choisissez une période, consultez la synthèse puis exportez-la.", periodMonth: "Mois", periodYear: "Année", periodCustom: "Personnalisée", from: "Du", to: "Au", year: "Année", monthLabel: "Mois",
  exportCsv: "Exporter en CSV", printPdf: "Imprimer / PDF", reportFor: "Rapport · {period}", generatedOn: "Généré le {date}", preparedBy: "Préparé par", signature: "Signature", exchangeRateUsed: "Dernière conversion : 1 {from} = {rate} {to} · {date}", balance: "Solde", budgetLabel: "Budget", details: "Détail des mouvements", type: "Type", expenseType: "Dépense", incomeType: "Revenu", byMonth: "Par mois", noData: "Aucune donnée sur cette période.", invalidRange: "La date de fin doit suivre la date de début.", transactions: "{count} mouvements", printHint: "Astuce : choisissez « Enregistrer au format PDF » dans la fenêtre d’impression.",
  cat_food: "Alimentation", cat_transport: "Transport", cat_phone: "Téléphone et internet", cat_subscriptions: "Abonnements", cat_clothes: "Vêtements", cat_health: "Santé", cat_entertainment: "Loisirs", cat_family: "Famille et cadeaux", cat_shopping: "Achats", cat_other: "Autres",
} as const;

export type BudgetKey = keyof typeof budgetFr;

const budgetEn: Record<BudgetKey, string> = {
  title: "Budget", subtitle: "Expenses, income, savings and recurring payments, month by month.",
  navOverview: "Overview", navExpenses: "Transactions", navRecurring: "Recurring", navReports: "Reports", subnav: "Budget sections",
  prevMonth: "Previous month", nextMonth: "Next month", thisMonth: "This month",
  loading: "Loading…", save: "Save", saving: "Saving…", cancel: "Cancel", edit: "Edit", remove: "Delete", add: "Add", optional: "optional",
  confirmDelete: "Delete “{name}”? This cannot be undone.", loadError: "Could not load the budget:", saveError: "Could not save:", missingTables: "The Budget schema is not installed. Apply the Supabase migrations with supabase db push.",
  income: "Income", expenses: "Expenses", net: "Net balance", remaining: "Budget left", overBy: "Over by {amount}", noBudget: "No budget set",
  budgetUsed: "{percent}% of budget used", spendingVsBudget: "Spending vs budget", byCategory: "By category", noExpensesMonth: "No expenses this month.", total: "Total",
  budgetSettings: "This month’s budget", settingsHint: "These values apply to this month. Later months keep them until you change them.",
  settingsInherited: "Nothing saved for this month yet: showing the values from the previous month.", monthlyLimit: "Monthly spending limit", annualBudget: "Annual budget", savingsGoal: "Savings goal", settingsSaved: "Budget saved.", currencyNote: "Currency: {currency}. Change it in your profile.",
  savings: "Savings", savingsBalance: "Savings balance", savingsHint: "The balance is calculated: all income up to this month, plus your corrections.", goalProgress: "{percent}% of your goal", noGoal: "No goal set",
  addToSavings: "Add to savings", correctSavings: "Correct total", amountToAdd: "Amount to add", targetBalance: "New balance", note: "Note", savingsUpdated: "Savings updated.",
  recentExpenses: "Latest expenses", viewAll: "View all", upcoming: "Upcoming payments", noUpcoming: "No upcoming payments.", overdue: "{days} d overdue", dueToday: "Today", dueIn: "In {days} d", markPaid: "Mark paid", paidDone: "Payment recorded, next due date updated.", addExpense: "Add an expense",
  expensesTab: "Expenses", incomeTab: "Income", searchPlaceholder: "Search expenses", allCategories: "All", noResults: "No results.", showMore: "Show more",
  editExpense: "Edit expense", saveExpense: "Save expense", name: "Name", namePlaceholder: "e.g. groceries, taxi…", amount: "Amount", category: "Category", date: "Date", source: "Source", sourcePlaceholder: "e.g. salary, freelance…",
  addIncome: "Add income", incomeHint: "Every income is automatically added to your savings.", noIncomeMonth: "No income this month.", invalidForm: "Check the fields: a positive amount and a valid date are required.",
  expenseAdded: "Expense added.", expenseUpdated: "Expense updated.", expenseDeleted: "Expense deleted.", incomeAdded: "Income added.", incomeDeleted: "Income deleted.",
  recurringTitle: "Recurring payments", recurringSubtitle: "Subscriptions and bills. Upcoming due dates are highlighted here.", addRecurring: "Add a payment", editRecurring: "Edit payment", saveRecurring: "Save payment",
  frequency: "Frequency", monthly: "Monthly", yearly: "Yearly", nextDue: "Next due date", remindDays: "Highlight (days before)", remindHint: "The payment is highlighted this many days before it is due.", emailReminder: "Send an email reminder", emailReminderHint: "Sent to your account email within the reminder window above.", notes: "Notes",
  pause: "Pause", resume: "Resume", paused: "Paused", noRecurring: "No recurring payments yet.", monthlyCost: "Average monthly cost", activeCount: "{count} active", sendTestEmail: "Send test email", sendingTestEmail: "Sending test…", emailTestSent: "Email accepted by provider. Check your inbox and spam folder.", emailTestUnavailable: "The email service is temporarily unavailable.", emailTestEmailNotConfigured: "Configure SMTP or Resend before sending a test.", emailTestMigrationMissing: "Apply the Supabase Budget reminders migration before testing.", emailTestCooldown: "Wait one minute before sending another test email.", emailTestFailed: "Could not send the test email.",
  recurringAdded: "Payment added.", recurringUpdated: "Payment updated.", recurringDeleted: "Payment deleted.", every: "{frequency} · {date}",
  reportsTitle: "Reports", reportsSubtitle: "Pick a period, review the summary, then export it.", periodMonth: "Month", periodYear: "Year", periodCustom: "Custom", from: "From", to: "To", year: "Year", monthLabel: "Month",
  exportCsv: "Export CSV", printPdf: "Print / PDF", reportFor: "Report · {period}", generatedOn: "Generated on {date}", preparedBy: "Prepared by", signature: "Signature", exchangeRateUsed: "Latest conversion: 1 {from} = {rate} {to} · {date}", balance: "Balance", budgetLabel: "Budget", details: "Transaction details", type: "Type", expenseType: "Expense", incomeType: "Income", byMonth: "By month", noData: "No data for this period.", invalidRange: "The end date must not be before the start date.", transactions: "{count} transactions", printHint: "Tip: choose “Save as PDF” in the print dialog.",
  cat_food: "Food", cat_transport: "Transport", cat_phone: "Phone & internet", cat_subscriptions: "Subscriptions", cat_clothes: "Clothes", cat_health: "Health", cat_entertainment: "Entertainment", cat_family: "Family & gifts", cat_shopping: "Shopping", cat_other: "Other",
};

const budgetAr: Record<BudgetKey, string> = {
  title: "الميزانية", subtitle: "المصاريف والمداخيل والادخار والمدفوعات المتكررة، شهرًا بشهر.",
  navOverview: "نظرة عامة", navExpenses: "العمليات", navRecurring: "المتكررة", navReports: "التقارير", subnav: "أقسام الميزانية",
  prevMonth: "الشهر السابق", nextMonth: "الشهر التالي", thisMonth: "هذا الشهر",
  loading: "جارٍ التحميل…", save: "حفظ", saving: "جارٍ الحفظ…", cancel: "إلغاء", edit: "تعديل", remove: "حذف", add: "إضافة", optional: "اختياري",
  confirmDelete: "حذف «{name}»؟ لا يمكن التراجع عن هذا الإجراء.", loadError: "تعذّر تحميل الميزانية:", saveError: "تعذّر الحفظ:", missingTables: "مخطط الميزانية غير مثبت. طبّق ترحيلات Supabase باستخدام supabase db push.",
  income: "المداخيل", expenses: "المصاريف", net: "الرصيد الصافي", remaining: "الميزانية المتبقية", overBy: "تجاوز بمقدار {amount}", noBudget: "لم تُحدَّد ميزانية",
  budgetUsed: "تم استهلاك {percent}% من الميزانية", spendingVsBudget: "المصاريف مقابل الميزانية", byCategory: "حسب الفئة", noExpensesMonth: "لا توجد مصاريف هذا الشهر.", total: "المجموع",
  budgetSettings: "ميزانية هذا الشهر", settingsHint: "تنطبق هذه القيم على هذا الشهر. تحتفظ بها الأشهر التالية إلى أن تغيّرها.",
  settingsInherited: "لا توجد إعدادات محفوظة لهذا الشهر بعد: تُعرض قيم الشهر السابق.", monthlyLimit: "حد المصاريف الشهري", annualBudget: "الميزانية السنوية", savingsGoal: "هدف الادخار", settingsSaved: "تم حفظ الميزانية.", currencyNote: "العملة: {currency}. يمكن تغييرها من الملف الشخصي.",
  savings: "الادخار", savingsBalance: "رصيد الادخار", savingsHint: "الرصيد محسوب: كل المداخيل حتى هذا الشهر، مع تصحيحاتك.", goalProgress: "{percent}% من هدفك", noGoal: "لم يُحدَّد هدف",
  addToSavings: "إضافة إلى الادخار", correctSavings: "تصحيح المجموع", amountToAdd: "المبلغ المراد إضافته", targetBalance: "الرصيد الجديد", note: "ملاحظة", savingsUpdated: "تم تحديث الادخار.",
  recentExpenses: "آخر المصاريف", viewAll: "عرض الكل", upcoming: "المدفوعات القادمة", noUpcoming: "لا توجد مدفوعات قادمة.", overdue: "متأخر {days} يوم", dueToday: "اليوم", dueIn: "بعد {days} يوم", markPaid: "تم الدفع", paidDone: "تم تسجيل الدفعة وتحديث الاستحقاق التالي.", addExpense: "إضافة مصروف",
  expensesTab: "المصاريف", incomeTab: "المداخيل", searchPlaceholder: "ابحث في المصاريف", allCategories: "الكل", noResults: "لا توجد نتائج.", showMore: "عرض المزيد",
  editExpense: "تعديل المصروف", saveExpense: "حفظ المصروف", name: "الاسم", namePlaceholder: "مثال: مشتريات، سيارة أجرة…", amount: "المبلغ", category: "الفئة", date: "التاريخ", source: "المصدر", sourcePlaceholder: "مثال: راتب، عمل حر…",
  addIncome: "إضافة دخل", incomeHint: "يُضاف كل دخل تلقائيًا إلى ادخارك.", noIncomeMonth: "لا توجد مداخيل هذا الشهر.", invalidForm: "تحقق من الحقول: مبلغ موجب وتاريخ صالح مطلوبان.",
  expenseAdded: "تمت إضافة المصروف.", expenseUpdated: "تم تعديل المصروف.", expenseDeleted: "تم حذف المصروف.", incomeAdded: "تمت إضافة الدخل.", incomeDeleted: "تم حذف الدخل.",
  recurringTitle: "المدفوعات المتكررة", recurringSubtitle: "الاشتراكات والفواتير. تظهر هنا الاستحقاقات القريبة.", addRecurring: "إضافة دفعة", editRecurring: "تعديل الدفعة", saveRecurring: "حفظ الدفعة",
  frequency: "التكرار", monthly: "شهري", yearly: "سنوي", nextDue: "الاستحقاق التالي", remindDays: "التنبيه (أيام قبل)", remindHint: "تُبرَز الدفعة قبل استحقاقها بهذا العدد من الأيام.", emailReminder: "إرسال تذكير عبر البريد الإلكتروني", emailReminderHint: "يُرسل إلى بريد حسابك خلال فترة التنبيه المحددة أعلاه.", notes: "ملاحظات",
  pause: "إيقاف مؤقت", resume: "استئناف", paused: "متوقفة", noRecurring: "لا توجد مدفوعات متكررة بعد.", monthlyCost: "متوسط التكلفة الشهرية", activeCount: "{count} نشطة", sendTestEmail: "إرسال بريد تجريبي", sendingTestEmail: "جارٍ الإرسال…", emailTestSent: "قبل مزود الخدمة البريد. تحقق من الوارد والرسائل غير المرغوب فيها.", emailTestUnavailable: "خدمة البريد غير متاحة مؤقتًا.", emailTestEmailNotConfigured: "أضف إعدادات SMTP أو Resend قبل إرسال الاختبار.", emailTestMigrationMissing: "طبّق ترحيل تذكيرات الميزانية في Supabase قبل الاختبار.", emailTestCooldown: "انتظر دقيقة قبل إرسال بريد تجريبي آخر.", emailTestFailed: "تعذّر إرسال البريد التجريبي.",
  recurringAdded: "تمت إضافة الدفعة.", recurringUpdated: "تم تعديل الدفعة.", recurringDeleted: "تم حذف الدفعة.", every: "{frequency} · {date}",
  reportsTitle: "التقارير", reportsSubtitle: "اختر فترة، راجع الملخص ثم صدّره.", periodMonth: "شهر", periodYear: "سنة", periodCustom: "مخصصة", from: "من", to: "إلى", year: "السنة", monthLabel: "الشهر",
  exportCsv: "تصدير CSV", printPdf: "طباعة / PDF", reportFor: "تقرير · {period}", generatedOn: "أُنشئ في {date}", preparedBy: "أُعدّ بواسطة", signature: "التوقيع", exchangeRateUsed: "آخر تحويل: 1 {from} = {rate} {to} · {date}", balance: "الرصيد", budgetLabel: "الميزانية", details: "تفاصيل العمليات", type: "النوع", expenseType: "مصروف", incomeType: "دخل", byMonth: "حسب الشهر", noData: "لا توجد بيانات لهذه الفترة.", invalidRange: "يجب ألا يسبق تاريخ النهاية تاريخ البداية.", transactions: "{count} عملية", printHint: "نصيحة: اختر «حفظ بصيغة PDF» في نافذة الطباعة.",
  cat_food: "الغذاء", cat_transport: "النقل", cat_phone: "الهاتف والإنترنت", cat_subscriptions: "الاشتراكات", cat_clothes: "الملابس", cat_health: "الصحة", cat_entertainment: "الترفيه", cat_family: "العائلة والهدايا", cat_shopping: "التسوق", cat_other: "أخرى",
};

export const budgetMessages = { fr: budgetFr as Record<BudgetKey, string>, en: budgetEn, ar: budgetAr };
export type BudgetLanguage = keyof typeof budgetMessages;

export function formatText(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
