export type MathCommandCategory =
  | "fundamentals"
  | "calculus"
  | "vector-calculus"
  | "linear-algebra"
  | "differential-equations"
  | "probability-statistics"
  | "complex-analysis"
  | "transforms"
  | "optimization"
  | "logic-sets"
  | "structure";

export type MathCommandItem = {
  id: string;
  label: string;
  shortcut: string;
  keywords?: string[];
  preview: string;
  insertText: string;
  appendSpace?: boolean;
  cursorOffset?: number;
  active?: boolean;
  category: MathCommandCategory;
  level?: "core" | "advanced";
};

export const MATH_CATEGORY_LABELS: Record<MathCommandCategory, string> = {
  fundamentals: "Fundamentals",
  calculus: "Calculus",
  "vector-calculus": "Vector Calculus",
  "linear-algebra": "Linear Algebra",
  "differential-equations": "Differential Equations",
  "probability-statistics": "Probability & Statistics",
  "complex-analysis": "Complex Analysis",
  transforms: "Transforms",
  optimization: "Optimization",
  "logic-sets": "Logic & Sets",
  structure: "Structure",
};

const CATEGORY_SEARCH_HINTS: Record<MathCommandCategory, string[]> = {
  fundamentals: ["basic", "dasar", "symbol", "simbol"],
  calculus: ["calculus", "kalkulus", "integral", "derivative", "turunan"],
  "vector-calculus": ["vector", "vektor", "jacobian", "hessian", "nabla"],
  "linear-algebra": ["matrix", "matriks", "eigen", "svd", "determinant"],
  "differential-equations": ["ode", "pde", "differential", "persamaan"],
  "probability-statistics": [
    "probability",
    "statistik",
    "bayes",
    "expectation",
  ],
  "complex-analysis": ["complex", "kontur", "residue", "euler"],
  transforms: ["laplace", "fourier", "transform", "transformasi"],
  optimization: ["optim", "argmin", "argmax", "kkt", "lagrangian"],
  "logic-sets": ["logic", "set", "himpunan", "forall", "exists"],
  structure: ["proof", "teorema", "lemma", "definition", "align"],
};

const QUERY_STOP_WORDS = new Set([
  "dari",
  "sampai",
  "terhadap",
  "menuju",
  "ke",
  "untuk",
  "dan",
  "the",
  "to",
  "from",
  "of",
  "with",
  "wrt",
  "for",
  "is",
  "a",
  "an",
]);

const ADVANCED_QUERY_SIGNALS = [
  "jacobian",
  "hessian",
  "laplace",
  "fourier",
  "residue",
  "kkt",
  "pde",
  "ode",
  "argmin",
  "argmax",
  "eigen",
  "svd",
  "covariance",
  "probabilitas",
  "variansi",
];

const INTENT_CATEGORY_PATTERNS: Array<{
  category: MathCommandCategory;
  test: RegExp;
}> = [
  {
    category: "transforms",
    test: /(laplace|fourier|transform|transformasi)/i,
  },
  {
    category: "optimization",
    test: /(argmin|argmax|kkt|lagrange|optim)/i,
  },
  {
    category: "complex-analysis",
    test: /(complex|kompleks|contour|kontur|residue)/i,
  },
  {
    category: "probability-statistics",
    test: /(probabilitas|probability|expectation|ekspektasi|variance|variansi|bayes|covariance|kovarians)/i,
  },
  {
    category: "differential-equations",
    test: /(ode|pde|differential equation|persamaan diferensial|heat equation|wave equation)/i,
  },
  {
    category: "linear-algebra",
    test: /(matrix|matriks|determinant|eigen|svd|trace|inverse)/i,
  },
  {
    category: "vector-calculus",
    test: /(gradient|gradien|divergence|divergensi|curl|laplacian|jacobian|hessian|nabla)/i,
  },
  {
    category: "logic-sets",
    test: /(set|himpunan|forall|exists|subset|union|intersection|implikasi|logic)/i,
  },
  {
    category: "structure",
    test: /(teorema|lemma|proof|bukti|definisi|korolari|align|piecewise)/i,
  },
  {
    category: "calculus",
    test: /(integral|limit|turunan|derivative|partial|parsial)/i,
  },
];

const parseVariableList = (value: string): string[] => {
  return value
    .split(/,|\bdan\b|\band\b/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/\s+/g, " "));
};

const normalizeLimitTarget = (value: string): string => {
  if (value === "tak hingga" || value === "infinity") {
    return "∞";
  }
  if (value === "minus tak hingga" || value === "-infinity") {
    return "-∞";
  }
  return value;
};

const normalizeIntentText = (value: string): string => {
  return value
    .toLowerCase()
    .replaceAll("∞", " tak hingga ")
    .replaceAll("->", " menuju ")
    .replaceAll("→", " menuju ")
    .replaceAll(/\s+/g, " ")
    .trim();
};

export const MATH_COMMANDS: MathCommandItem[] = [
  {
    id: "fraction",
    label: "Fraction",
    shortcut: "pecahan",
    keywords: ["pecahan", "fraction", "frac", "rasio", "bagi"],
    preview: "a/b",
    insertText: "frac(a, b)",
    appendSpace: false,
    cursorOffset: 4,
    active: true,
    category: "fundamentals",
    level: "core",
  },
  {
    id: "sqrt",
    label: "Square Root",
    shortcut: "akar",
    keywords: ["akar", "sqrt", "root", "akar kuadrat"],
    preview: "sqrt(x)",
    insertText: "sqrt(x)",
    cursorOffset: 2,
    category: "fundamentals",
    level: "core",
  },
  {
    id: "nth-root",
    label: "N-th Root",
    shortcut: "akar-n",
    keywords: ["akar n", "nth root", "n root", "akar pangkat"],
    preview: "root(x, n)",
    insertText: "root(x, n)",
    cursorOffset: 4,
    category: "fundamentals",
    level: "core",
  },
  {
    id: "superscript",
    label: "Superscript",
    shortcut: "pangkat",
    keywords: ["pangkat", "superscript", "power", "eksponen"],
    preview: "x^n",
    insertText: "x^n",
    category: "fundamentals",
    level: "core",
  },
  {
    id: "subscript",
    label: "Subscript",
    shortcut: "subskrip",
    keywords: ["subskrip", "subscript", "index"],
    preview: "x_n",
    insertText: "x_n",
    category: "fundamentals",
    level: "core",
  },
  {
    id: "infinity",
    label: "Infinity",
    shortcut: "tak-hingga",
    keywords: ["tak hingga", "infinity", "inf", "∞"],
    preview: "∞",
    insertText: "∞",
    category: "fundamentals",
    level: "core",
  },
  {
    id: "pi",
    label: "Pi",
    shortcut: "pi",
    keywords: ["pi", "konstanta", "π"],
    preview: "π",
    insertText: "π",
    category: "fundamentals",
    level: "core",
  },
  {
    id: "euler-constant",
    label: "Euler Constant",
    shortcut: "euler",
    keywords: ["euler", "bilangan e", "exp"],
    preview: "e^x",
    insertText: "e^x",
    category: "fundamentals",
    level: "core",
  },
  {
    id: "limit",
    label: "Limit",
    shortcut: "limit",
    keywords: ["limit", "lim", "mendekati"],
    preview: "lim_(x->a)",
    insertText: "lim_(x->a) f(x)",
    cursorOffset: 8,
    category: "calculus",
    level: "core",
  },
  {
    id: "derivative",
    label: "Derivative",
    shortcut: "turunan",
    keywords: ["turunan", "derivative", "differential", "diff", "d/dx"],
    preview: "d/dx f(x)",
    insertText: "d/dx f(x)",
    cursorOffset: 5,
    category: "calculus",
    level: "core",
  },
  {
    id: "second-derivative",
    label: "Second Derivative",
    shortcut: "turunan-2",
    keywords: ["turunan kedua", "second derivative", "d2"],
    preview: "d^2/dx^2 f(x)",
    insertText: "d^2/(dx^2) f(x)",
    cursorOffset: 9,
    category: "calculus",
    level: "advanced",
  },
  {
    id: "partial-derivative",
    label: "Partial Derivative",
    shortcut: "parsial",
    keywords: ["parsial", "partial", "∂", "partial derivative"],
    preview: "∂f/∂x",
    insertText: "∂f/∂x",
    category: "calculus",
    level: "core",
  },
  {
    id: "mixed-partial",
    label: "Mixed Partial",
    shortcut: "parsial-campur",
    keywords: ["mixed partial", "turunan campur", "∂2"],
    preview: "∂^2f/(∂x∂y)",
    insertText: "∂^2f/(∂x∂y)",
    category: "calculus",
    level: "advanced",
  },
  {
    id: "integral",
    label: "Integral",
    shortcut: "integral",
    keywords: ["integral", "int", "anti turunan"],
    preview: "∫ f(x) dx",
    insertText: "∫ f(x) dx",
    cursorOffset: 8,
    category: "calculus",
    level: "core",
  },
  {
    id: "definite-integral",
    label: "Definite Integral",
    shortcut: "integral-batas",
    keywords: ["definite integral", "integral tentu", "batas"],
    preview: "∫_a^b f(x) dx",
    insertText: "∫_a^b f(x) dx",
    cursorOffset: 10,
    category: "calculus",
    level: "core",
  },
  {
    id: "improper-integral",
    label: "Improper Integral",
    shortcut: "integral-takhingga",
    keywords: ["improper", "integral tak hingga", "infinite integral"],
    preview: "∫_0^∞ f(x) dx",
    insertText: "∫_0^∞ f(x) dx",
    cursorOffset: 10,
    category: "calculus",
    level: "advanced",
  },
  {
    id: "double-integral",
    label: "Double Integral",
    shortcut: "integral-ganda",
    keywords: ["integral ganda", "double integral", "iint", "∬"],
    preview: "∬_D f(x, y) dA",
    insertText: "∬_D f(x, y) dA",
    cursorOffset: 9,
    category: "calculus",
    level: "advanced",
  },
  {
    id: "triple-integral",
    label: "Triple Integral",
    shortcut: "integral-tiga",
    keywords: ["integral tiga", "triple integral", "iiint", "∭"],
    preview: "∭_V f(x, y, z) dV",
    insertText: "∭_V f(x, y, z) dV",
    cursorOffset: 9,
    category: "calculus",
    level: "advanced",
  },
  {
    id: "line-integral",
    label: "Line Integral",
    shortcut: "integral-garis",
    keywords: ["line integral", "integral garis", "curve integral"],
    preview: "∮_C F · dr",
    insertText: "∮_C F · dr",
    category: "vector-calculus",
    level: "advanced",
  },
  {
    id: "surface-integral",
    label: "Surface Integral",
    shortcut: "integral-permukaan",
    keywords: ["surface integral", "integral permukaan", "flux"],
    preview: "∯_S F · dS",
    insertText: "∯_S F · dS",
    category: "vector-calculus",
    level: "advanced",
  },
  {
    id: "gradient",
    label: "Gradient",
    shortcut: "gradien",
    keywords: ["gradien", "gradient", "nabla", "∇"],
    preview: "∇f",
    insertText: "∇f",
    category: "vector-calculus",
    level: "core",
  },
  {
    id: "divergence",
    label: "Divergence",
    shortcut: "divergensi",
    keywords: ["divergensi", "divergence", "div"],
    preview: "∇·F",
    insertText: "∇·F",
    category: "vector-calculus",
    level: "core",
  },
  {
    id: "curl",
    label: "Curl",
    shortcut: "curl",
    keywords: ["curl", "rotasi", "rot"],
    preview: "∇×F",
    insertText: "∇×F",
    category: "vector-calculus",
    level: "core",
  },
  {
    id: "laplacian",
    label: "Laplacian",
    shortcut: "laplace",
    keywords: ["laplace", "laplacian", "∇²"],
    preview: "∇²f",
    insertText: "∇²f",
    category: "vector-calculus",
    level: "advanced",
  },
  {
    id: "jacobian",
    label: "Jacobian Matrix",
    shortcut: "jacobian",
    keywords: ["jacobian", "matrix jacobian", "∂f/∂x"],
    preview: "J = [∂f_i/∂x_j]",
    insertText: "J = [∂f_i/∂x_j]",
    category: "vector-calculus",
    level: "advanced",
  },
  {
    id: "hessian",
    label: "Hessian Matrix",
    shortcut: "hessian",
    keywords: ["hessian", "matrix hessian", "turunan kedua"],
    preview: "H_f = [∂^2f/(∂x_i∂x_j)]",
    insertText: "H_f = [∂^2f/(∂x_i∂x_j)]",
    category: "vector-calculus",
    level: "advanced",
  },
  {
    id: "matrix-2x2",
    label: "Matrix 2x2",
    shortcut: "matriks-2",
    keywords: ["matriks", "matrix", "2x2"],
    preview: "[a b; c d]",
    insertText: "[a b; c d]",
    cursorOffset: 7,
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "matrix-3x3",
    label: "Matrix 3x3",
    shortcut: "matriks-3",
    keywords: ["matrix 3", "matriks 3", "3x3"],
    preview: "[a b c; d e f; g h i]",
    insertText: "[a b c; d e f; g h i]",
    cursorOffset: 13,
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "determinant",
    label: "Determinant",
    shortcut: "determinan",
    keywords: ["determinan", "determinant", "det"],
    preview: "det(A)",
    insertText: "det(A)",
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "inverse-matrix",
    label: "Matrix Inverse",
    shortcut: "inverse",
    keywords: ["inverse", "matriks invers", "A^-1"],
    preview: "A^-1",
    insertText: "A^(-1)",
    category: "linear-algebra",
    level: "advanced",
  },
  {
    id: "trace",
    label: "Trace",
    shortcut: "trace",
    keywords: ["trace", "tr", "diagonal sum"],
    preview: "tr(A)",
    insertText: "tr(A)",
    category: "linear-algebra",
    level: "advanced",
  },
  {
    id: "eigen",
    label: "Eigenvalue Equation",
    shortcut: "eigen",
    keywords: ["eigen", "eigenvalue", "eigenvector", "nilai eigen"],
    preview: "A v = λ v",
    insertText: "A v = λ v",
    category: "linear-algebra",
    level: "advanced",
  },
  {
    id: "svd",
    label: "Singular Value Decomposition",
    shortcut: "svd",
    keywords: ["svd", "singular value", "decomposition"],
    preview: "A = U Σ V^T",
    insertText: "A = U Σ V^T",
    category: "linear-algebra",
    level: "advanced",
  },
  {
    id: "dot-product",
    label: "Dot Product",
    shortcut: "dot",
    keywords: ["dot", "dot product", "hasil kali titik"],
    preview: "u · v",
    insertText: "u · v",
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "cross-product",
    label: "Cross Product",
    shortcut: "cross",
    keywords: ["cross", "cross product", "hasil kali silang"],
    preview: "u × v",
    insertText: "u × v",
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "norm",
    label: "Norm",
    shortcut: "norma",
    keywords: ["norma", "norm", "panjang vektor"],
    preview: "||v||",
    insertText: "||v||",
    cursorOffset: 2,
    category: "linear-algebra",
    level: "core",
  },
  {
    id: "ode-first-order",
    label: "First-order ODE",
    shortcut: "ode-1",
    keywords: ["ode", "differential equation", "persamaan diferensial"],
    preview: "dy/dx = f(x, y)",
    insertText: "dy/dx = f(x, y)",
    category: "differential-equations",
    level: "advanced",
  },
  {
    id: "ode-second-order",
    label: "Second-order ODE",
    shortcut: "ode-2",
    keywords: ["ode second", "turunan kedua", "d2y"],
    preview: "d^2y/dx^2 + a dy/dx + by = 0",
    insertText: "d^2y/dx^2 + a dy/dx + b y = 0",
    category: "differential-equations",
    level: "advanced",
  },
  {
    id: "pde-heat",
    label: "Heat Equation",
    shortcut: "heat",
    keywords: ["heat equation", "persamaan panas", "pde"],
    preview: "∂u/∂t = α ∂^2u/∂x^2",
    insertText: "∂u/∂t = α ∂^2u/∂x^2",
    category: "differential-equations",
    level: "advanced",
  },
  {
    id: "pde-wave",
    label: "Wave Equation",
    shortcut: "wave",
    keywords: ["wave equation", "persamaan gelombang", "pde"],
    preview: "∂^2u/∂t^2 = c^2 ∂^2u/∂x^2",
    insertText: "∂^2u/∂t^2 = c^2 ∂^2u/∂x^2",
    category: "differential-equations",
    level: "advanced",
  },
  {
    id: "separation-variables",
    label: "Separation of Variables",
    shortcut: "separable",
    keywords: ["separation", "separable", "pemisahan variabel"],
    preview: "dy/g(y) = f(x) dx",
    insertText: "dy/g(y) = f(x) dx",
    category: "differential-equations",
    level: "advanced",
  },
  {
    id: "summation",
    label: "Summation",
    shortcut: "sigma",
    keywords: ["sigma", "sum", "summation", "jumlah", "∑"],
    preview: "∑_(k=1)^n",
    insertText: "∑_(k=1)^n",
    cursorOffset: 1,
    category: "probability-statistics",
    level: "core",
  },
  {
    id: "product",
    label: "Product",
    shortcut: "produk",
    keywords: ["produk", "product", "pi product", "∏"],
    preview: "∏_(k=1)^n",
    insertText: "∏_(k=1)^n",
    cursorOffset: 1,
    category: "probability-statistics",
    level: "core",
  },
  {
    id: "expectation",
    label: "Expectation",
    shortcut: "ekspektasi",
    keywords: ["expectation", "ekspektasi", "nilai harapan", "E[X]"],
    preview: "E[X]",
    insertText: "E[X]",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "variance",
    label: "Variance",
    shortcut: "variansi",
    keywords: ["variance", "variansi", "Var"],
    preview: "Var(X)",
    insertText: "Var(X)",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "covariance",
    label: "Covariance",
    shortcut: "kovarians",
    keywords: ["covariance", "cov", "kovarians"],
    preview: "Cov(X, Y)",
    insertText: "Cov(X, Y)",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "normal-distribution",
    label: "Normal Distribution",
    shortcut: "normal",
    keywords: ["normal distribution", "gaussian", "distribusi normal"],
    preview: "X ~ N(μ, σ^2)",
    insertText: "X ~ N(μ, σ^2)",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "conditional-probability",
    label: "Conditional Probability",
    shortcut: "kondisional",
    keywords: ["conditional", "probabilitas kondisional", "P(A|B)"],
    preview: "P(A | B)",
    insertText: "P(A | B)",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "bayes",
    label: "Bayes Rule",
    shortcut: "bayes",
    keywords: ["bayes", "bayes theorem", "teorema bayes"],
    preview: "P(A|B)=P(B|A)P(A)/P(B)",
    insertText: "P(A | B) = (P(B | A) P(A)) / P(B)",
    category: "probability-statistics",
    level: "advanced",
  },
  {
    id: "complex-number",
    label: "Complex Number",
    shortcut: "kompleks",
    keywords: ["complex", "bilangan kompleks", "a+bi"],
    preview: "z = a + bi",
    insertText: "z = a + b i",
    category: "complex-analysis",
    level: "core",
  },
  {
    id: "modulus-argument",
    label: "Modulus and Argument",
    shortcut: "mod-arg",
    keywords: ["modulus", "argument", "polar", "|z|"],
    preview: "z = r(cos θ + i sin θ)",
    insertText: "z = r (cos(theta) + i sin(theta))",
    category: "complex-analysis",
    level: "advanced",
  },
  {
    id: "euler-formula",
    label: "Euler Formula",
    shortcut: "euler-form",
    keywords: ["euler formula", "exp", "e^(iθ)"],
    preview: "e^(iθ) = cos θ + i sin θ",
    insertText: "e^(i theta) = cos(theta) + i sin(theta)",
    category: "complex-analysis",
    level: "advanced",
  },
  {
    id: "contour-integral",
    label: "Contour Integral",
    shortcut: "kontur",
    keywords: ["contour integral", "integral kontur", "complex integral"],
    preview: "∮_C f(z) dz",
    insertText: "∮_C f(z) dz",
    category: "complex-analysis",
    level: "advanced",
  },
  {
    id: "residue",
    label: "Residue Theorem",
    shortcut: "residue",
    keywords: ["residue", "teorema residu", "complex"],
    preview: "∮ f(z) dz = 2πi Σ Res(f, z_k)",
    insertText: "∮_C f(z) dz = 2 π i ∑ Res(f, z_k)",
    category: "complex-analysis",
    level: "advanced",
  },
  {
    id: "laplace-transform",
    label: "Laplace Transform",
    shortcut: "laplace-t",
    keywords: ["laplace transform", "transformasi laplace", "L{f}"],
    preview: "L{f(t)} = ∫_0^∞ e^(-st) f(t) dt",
    insertText: "L{f(t)} = ∫_0^∞ e^(-s t) f(t) dt",
    category: "transforms",
    level: "advanced",
  },
  {
    id: "inverse-laplace",
    label: "Inverse Laplace",
    shortcut: "laplace-inv",
    keywords: ["inverse laplace", "laplace inverse", "L^-1"],
    preview: "f(t) = L^(-1){F(s)}",
    insertText: "f(t) = L^(-1){F(s)}",
    category: "transforms",
    level: "advanced",
  },
  {
    id: "fourier-transform",
    label: "Fourier Transform",
    shortcut: "fourier",
    keywords: ["fourier", "transformasi fourier", "fft"],
    preview: "F(ω)=∫ f(t)e^(-iωt) dt",
    insertText: "F(ω) = ∫_(-∞)^∞ f(t) e^(-i ω t) dt",
    category: "transforms",
    level: "advanced",
  },
  {
    id: "inverse-fourier",
    label: "Inverse Fourier",
    shortcut: "fourier-inv",
    keywords: ["inverse fourier", "invers fourier"],
    preview: "f(t)=1/(2π)∫ F(ω)e^(iωt)dω",
    insertText: "f(t) = 1/(2 π) ∫_(-∞)^∞ F(ω) e^(i ω t) dω",
    category: "transforms",
    level: "advanced",
  },
  {
    id: "argmin",
    label: "Argmin",
    shortcut: "argmin",
    keywords: ["argmin", "minimum", "optimasi"],
    preview: "arg min_x f(x)",
    insertText: "arg min_(x) f(x)",
    category: "optimization",
    level: "advanced",
  },
  {
    id: "argmax",
    label: "Argmax",
    shortcut: "argmax",
    keywords: ["argmax", "maximum", "optimasi"],
    preview: "arg max_x f(x)",
    insertText: "arg max_(x) f(x)",
    category: "optimization",
    level: "advanced",
  },
  {
    id: "gradient-descent",
    label: "Gradient Descent Update",
    shortcut: "gd",
    keywords: ["gradient descent", "optimasi", "update"],
    preview: "x_(k+1)=x_k-η∇f(x_k)",
    insertText: "x_(k+1) = x_k - η ∇f(x_k)",
    category: "optimization",
    level: "advanced",
  },
  {
    id: "lagrangian",
    label: "Lagrangian",
    shortcut: "lagrange",
    keywords: ["lagrangian", "lagrange multipliers", "constraint"],
    preview: "L(x, λ)=f(x)+λg(x)",
    insertText: "L(x, λ) = f(x) + λ g(x)",
    category: "optimization",
    level: "advanced",
  },
  {
    id: "kkt",
    label: "KKT Conditions",
    shortcut: "kkt",
    keywords: ["kkt", "karush kuhntucker", "optimization constraints"],
    preview: "∇L=0, λ>=0, λ·g=0",
    insertText:
      "L(x, λ, μ) = f(x) + λ^T g(x) + μ^T h(x)\n∇_x L = 0\ng(x) <= 0, h(x) = 0\nλ >= 0, λ · g(x) = 0",
    category: "optimization",
    level: "advanced",
  },
  {
    id: "set-builder",
    label: "Set Builder",
    shortcut: "himpunan",
    keywords: ["set", "himpunan", "set builder", "{x | ...}"],
    preview: "{x | condition}",
    insertText: "{ x | condition(x) }",
    category: "logic-sets",
    level: "core",
  },
  {
    id: "union-intersection",
    label: "Union and Intersection",
    shortcut: "union",
    keywords: ["union", "intersection", "irisan", "gabungan"],
    preview: "A ∪ B, A ∩ B",
    insertText: "A ∪ B, A ∩ B",
    category: "logic-sets",
    level: "core",
  },
  {
    id: "subset",
    label: "Subset",
    shortcut: "subset",
    keywords: ["subset", "subhimpunan", "⊂", "⊆"],
    preview: "A ⊆ B",
    insertText: "A ⊆ B",
    category: "logic-sets",
    level: "core",
  },
  {
    id: "forall-exists",
    label: "Forall and Exists",
    shortcut: "quantifier",
    keywords: ["forall", "exists", "kuantor", "∀", "∃"],
    preview: "∀x ∈ A, ∃y",
    insertText: "∀ x ∈ A, ∃ y ∈ B",
    category: "logic-sets",
    level: "advanced",
  },
  {
    id: "implication",
    label: "Implication",
    shortcut: "implikasi",
    keywords: ["implication", "implikasi", "=>", "iff"],
    preview: "P => Q",
    insertText: "P => Q",
    category: "logic-sets",
    level: "core",
  },
  {
    id: "piecewise-function",
    label: "Piecewise Function",
    shortcut: "piecewise",
    keywords: ["piecewise", "cases", "kasus", "fungsi potongan"],
    preview: "{f(x), x>=0; g(x), x<0}",
    insertText: "{ f(x), x >= 0; g(x), x < 0 }",
    cursorOffset: 20,
    category: "structure",
    level: "core",
  },
  {
    id: "system-equations",
    label: "System of Equations",
    shortcut: "sistem",
    keywords: ["sistem", "system", "persamaan linear"],
    preview: "{a+b=0; c-d=1}",
    insertText: "{ a + b = 0; c - d = 1 }",
    cursorOffset: 18,
    category: "structure",
    level: "core",
  },
  {
    id: "aligned-equations",
    label: "Aligned Equations",
    shortcut: "align",
    keywords: ["align", "aligned", "turunan langkah"],
    preview: "a = b\n  = c",
    insertText: "a = b\n  = c\n  = d",
    cursorOffset: 9,
    category: "structure",
    level: "core",
  },
  {
    id: "definition-block",
    label: "Definition Block",
    shortcut: "definisi",
    keywords: ["definition", "definisi", "concept"],
    preview: "Definisi.",
    insertText: "Definisi.\nTuliskan definisi formal di sini.",
    cursorOffset: 31,
    category: "structure",
    level: "core",
  },
  {
    id: "theorem-block",
    label: "Theorem Block",
    shortcut: "teorema",
    keywords: ["teorema", "theorem", "proposisi"],
    preview: "Teorema.",
    insertText: "Teorema.\nTuliskan pernyataan teorema di sini.",
    cursorOffset: 31,
    category: "structure",
    level: "core",
  },
  {
    id: "lemma-block",
    label: "Lemma Block",
    shortcut: "lemma",
    keywords: ["lemma", "lemma block", "bantuan teorema"],
    preview: "Lemma.",
    insertText: "Lemma.\nTuliskan lemma pendukung di sini.",
    cursorOffset: 30,
    category: "structure",
    level: "core",
  },
  {
    id: "corollary-block",
    label: "Corollary Block",
    shortcut: "korolari",
    keywords: ["corollary", "korolari", "akibat"],
    preview: "Korolari.",
    insertText: "Korolari.\nTuliskan akibat langsung dari teorema.",
    cursorOffset: 34,
    category: "structure",
    level: "advanced",
  },
  {
    id: "proof-block",
    label: "Proof Block",
    shortcut: "bukti",
    keywords: ["bukti", "proof", "pembuktian"],
    preview: "Bukti. ...",
    insertText: "Bukti.\n1) Langkah awal.\n2) Turunan utama.\n3) Kesimpulan.",
    cursorOffset: 42,
    category: "structure",
    level: "core",
  },
];

export const getMathCommandCategoryLabel = (
  category: MathCommandCategory,
): string => {
  return MATH_CATEGORY_LABELS[category];
};

const tokenizeQuery = (query: string): string[] => {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

export const getMathCommandSearchScore = (
  command: MathCommandItem,
  query: string,
): number => {
  const normalizedQuery = query.trim().toLowerCase();
  const categoryHints = CATEGORY_SEARCH_HINTS[command.category];
  const baseScore =
    (command.active ? 120 : 68) + (command.level === "advanced" ? 4 : 11);

  if (!normalizedQuery) {
    return baseScore;
  }

  const searchableParts = [
    command.label,
    command.shortcut,
    getMathCommandCategoryLabel(command.category),
    ...categoryHints,
    ...(command.keywords ?? []),
  ].map((item) => item.toLowerCase());

  const searchableText = searchableParts.join(" ");
  let score = -12;

  if (command.shortcut.toLowerCase().startsWith(normalizedQuery)) {
    score += 104;
  }
  if (command.label.toLowerCase().startsWith(normalizedQuery)) {
    score += 90;
  }
  if (command.label.toLowerCase().includes(normalizedQuery)) {
    score += 62;
  }
  if (searchableText.includes(normalizedQuery)) {
    score += 34;
  }

  const tokens = tokenizeQuery(normalizedQuery);
  const meaningfulTokens = tokens.filter((token) => {
    if (/^\d+$/.test(token)) {
      return false;
    }
    return !QUERY_STOP_WORDS.has(token);
  });

  const advancedQuery = ADVANCED_QUERY_SIGNALS.some((signal) =>
    normalizedQuery.includes(signal),
  );
  let tokenMatches = 0;

  for (const token of meaningfulTokens) {
    if (searchableText.includes(token)) {
      score += 17;
      tokenMatches += 1;
      continue;
    }

    if (categoryHints.some((hint) => hint.includes(token))) {
      score += 9;
      tokenMatches += 1;
    }
  }

  if (advancedQuery && command.level === "advanced") {
    score += 24;
  }

  if (
    meaningfulTokens.length > 0 &&
    tokenMatches === 0 &&
    score < baseScore + 42
  ) {
    return -1;
  }

  return score + baseScore;
};

export const getIntentCategoryFromQuery = (
  query: string,
): MathCommandCategory => {
  for (const entry of INTENT_CATEGORY_PATTERNS) {
    if (entry.test.test(query)) {
      return entry.category;
    }
  }
  return "fundamentals";
};

export const isAdvancedIntentQuery = (query: string): boolean => {
  const normalized = query.toLowerCase();
  return ADVANCED_QUERY_SIGNALS.some((signal) => normalized.includes(signal));
};

export const buildIntentSnippet = (query: string): string | null => {
  const normalized = normalizeIntentText(query);

  const boundedIntegral = normalized.match(
    /(?:integral|∫)\s+(.+?)\s+(?:sampai|to)\s+(.+?)(?:\s+(?:of|untuk|fungsi)\s+(.+?))?(?:\s+d(?:if)?\s*([a-z]))?$/i,
  );
  if (boundedIntegral) {
    const lower = boundedIntegral[1]?.trim() ?? "a";
    const upper = normalizeLimitTarget(boundedIntegral[2]?.trim() ?? "b");
    const body = boundedIntegral[3]?.trim() ?? "f(x)";
    const variable = boundedIntegral[4]?.trim() ?? "x";
    return `∫_(${lower})^(${upper}) ${body} d${variable}`;
  }

  const doubleIntegral = normalized.match(
    /(?:integral ganda|double integral|iint)(?:\s+(?:of|untuk|fungsi))?\s+(.+?)(?:\s+(?:di|pada|over)\s+([a-z]))?$/i,
  );
  if (doubleIntegral) {
    const body = doubleIntegral[1]?.trim() ?? "f(x, y)";
    const domain = (doubleIntegral[2] ?? "D").trim();
    return `∬_(${domain}) ${body} dA`;
  }

  const tripleIntegral = normalized.match(
    /(?:integral tiga|triple integral|iiint)(?:\s+(?:of|untuk|fungsi))?\s+(.+?)(?:\s+(?:di|pada|over)\s+([a-z]))?$/i,
  );
  if (tripleIntegral) {
    const body = tripleIntegral[1]?.trim() ?? "f(x, y, z)";
    const domain = (tripleIntegral[2] ?? "V").trim();
    return `∭_(${domain}) ${body} dV`;
  }

  const contourIntegral = normalized.match(
    /(?:contour integral|integral kontur)\s+(?:of|untuk|fungsi)?\s*(.+?)(?:\s+(?:di|pada|over)\s+([a-z]))?$/i,
  );
  if (contourIntegral) {
    const body = contourIntegral[1]?.trim() || "f(z)";
    const curve = (contourIntegral[2] ?? "C").trim();
    return `∮_(${curve}) ${body} dz`;
  }

  const lineIntegral = normalized.match(
    /(?:line integral|integral garis)\s+(?:of|untuk|fungsi)?\s*(.+?)(?:\s+(?:di|pada|over)\s+([a-z]))?$/i,
  );
  if (lineIntegral) {
    const body = lineIntegral[1]?.trim() || "F";
    const curve = (lineIntegral[2] ?? "C").trim();
    return `∮_(${curve}) ${body} · dr`;
  }

  const limitIntent = normalized.match(
    /limit\s+([a-z])\s+(?:menuju|to)\s+(.+?)(?:\s+dari\s+(.+))?$/i,
  );
  if (limitIntent) {
    const variable = limitIntent[1] ?? "x";
    const toward = normalizeLimitTarget(limitIntent[2]?.trim() ?? "a");
    const expr = limitIntent[3]?.trim() ?? "f(x)";
    return `lim_(${variable}→${toward}) ${expr}`;
  }

  const secondDerivativeIntent = normalized.match(
    /(?:turunan kedua|second derivative)\s+(.+?)\s+(?:terhadap|with respect to|wrt)\s+([a-z])$/i,
  );
  if (secondDerivativeIntent) {
    const expr = secondDerivativeIntent[1]?.trim() ?? "f(x)";
    const variable = secondDerivativeIntent[2] ?? "x";
    return `d^2/(d${variable}^2) ${expr}`;
  }

  const derivativeIntent = normalized.match(
    /turunan\s+(.+?)\s+terhadap\s+([a-z])$/i,
  );
  if (derivativeIntent) {
    const expr = derivativeIntent[1]?.trim() ?? "f(x)";
    const variable = derivativeIntent[2] ?? "x";
    return `d/d${variable} ${expr}`;
  }

  const mixedPartialIntent = normalized.match(
    /(?:turunan parsial kedua|second partial derivative)\s+(.+?)\s+(?:terhadap|with respect to|wrt)\s+([a-z])\s+(?:dan|and)\s+([a-z])$/i,
  );
  if (mixedPartialIntent) {
    const expr = mixedPartialIntent[1]?.trim() ?? "f";
    const variableA = mixedPartialIntent[2] ?? "x";
    const variableB = mixedPartialIntent[3] ?? "y";
    return `∂^2${expr}/(∂${variableA}∂${variableB})`;
  }

  const partialIntent = normalized.match(
    /(turunan parsial|partial derivative)\s+(.+?)\s+terhadap\s+([a-z])$/i,
  );
  if (partialIntent) {
    const expr = partialIntent[2]?.trim() ?? "f";
    const variable = partialIntent[3] ?? "x";
    return `∂${expr}/∂${variable}`;
  }

  const jacobianIntent = normalized.match(
    /jacobian\s+(.+?)\s+(?:terhadap|with respect to|wrt)\s+(.+)$/i,
  );
  if (jacobianIntent) {
    const expr = jacobianIntent[1]?.trim() ?? "f";
    const variables = parseVariableList(jacobianIntent[2] ?? "x, y");
    const variableExpr = variables.join(", ") || "x, y";
    return `J = [∂(${expr})/∂(${variableExpr})]`;
  }

  const hessianIntent = normalized.match(
    /hessian\s+(.+?)(?:\s+(?:terhadap|with respect to|wrt)\s+(.+))?$/i,
  );
  if (hessianIntent) {
    const expr = hessianIntent[1]?.trim() ?? "f";
    const variables = parseVariableList(hessianIntent[2] ?? "x, y");
    const first = variables[0] ?? "x";
    const second = variables[1] ?? first;
    return `H_${expr} = [∂^2${expr}/(∂${first}∂${second})]`;
  }

  const expectationIntent = normalized.match(
    /(?:ekspektasi|expectation)\s+(?:dari|of)?\s+(.+)$/i,
  );
  if (expectationIntent) {
    const expr = expectationIntent[1]?.trim() ?? "X";
    return `E[${expr}]`;
  }

  const varianceIntent = normalized.match(
    /(?:variansi|variance)\s+(?:dari|of)?\s+(.+)$/i,
  );
  if (varianceIntent) {
    const expr = varianceIntent[1]?.trim() ?? "X";
    return `Var(${expr})`;
  }

  const covarianceIntent = normalized.match(
    /(?:kovarians|covariance)\s+(.+?)\s+(?:dan|and|,)\s+(.+)$/i,
  );
  if (covarianceIntent) {
    const left = covarianceIntent[1]?.trim() ?? "X";
    const right = covarianceIntent[2]?.trim() ?? "Y";
    return `Cov(${left}, ${right})`;
  }

  const conditionalProbabilityIntent = normalized.match(
    /(?:probabilitas kondisional|conditional probability)\s+(.+?)\s+(?:given|dengan syarat|\|)\s+(.+)$/i,
  );
  if (conditionalProbabilityIntent) {
    const target = conditionalProbabilityIntent[1]?.trim() ?? "A";
    const condition = conditionalProbabilityIntent[2]?.trim() ?? "B";
    return `P(${target} | ${condition})`;
  }

  if (normalized.includes("bayes")) {
    return "P(A | B) = (P(B | A) P(A)) / P(B)";
  }

  const laplaceTransformIntent = normalized.match(
    /(?:laplace transform|transformasi laplace)\s+(?:of|dari)?\s+(.+)$/i,
  );
  if (laplaceTransformIntent) {
    const expr = laplaceTransformIntent[1]?.trim() ?? "f(t)";
    return `L{${expr}} = ∫_0^∞ e^(-s t) ${expr} dt`;
  }

  const inverseLaplaceIntent = normalized.match(
    /(?:inverse laplace|laplace inverse|invers laplace)\s+(?:of|dari)?\s+(.+)$/i,
  );
  if (inverseLaplaceIntent) {
    const expr = inverseLaplaceIntent[1]?.trim() ?? "F(s)";
    return `L^(-1){${expr}}`;
  }

  const fourierTransformIntent = normalized.match(
    /(?:fourier transform|transformasi fourier)\s+(?:of|dari)?\s+(.+)$/i,
  );
  if (fourierTransformIntent) {
    const expr = fourierTransformIntent[1]?.trim() ?? "f(t)";
    return `F(ω) = ∫_(-∞)^∞ ${expr} e^(-i ω t) dt`;
  }

  const inverseFourierIntent = normalized.match(
    /(?:inverse fourier|invers fourier)\s+(?:of|dari)?\s+(.+)$/i,
  );
  if (inverseFourierIntent) {
    const expr = inverseFourierIntent[1]?.trim() ?? "F(ω)";
    return `f(t) = 1/(2 π) ∫_(-∞)^∞ ${expr} e^(i ω t) dω`;
  }

  const argminIntent = normalized.match(
    /argmin\s+(.+?)(?:\s+(?:terhadap|with respect to|wrt)\s+([a-z]))?$/i,
  );
  if (argminIntent) {
    const expr = argminIntent[1]?.trim() ?? "f(x)";
    const variable = argminIntent[2] ?? "x";
    return `arg min_(${variable}) ${expr}`;
  }

  const argmaxIntent = normalized.match(
    /argmax\s+(.+?)(?:\s+(?:terhadap|with respect to|wrt)\s+([a-z]))?$/i,
  );
  if (argmaxIntent) {
    const expr = argmaxIntent[1]?.trim() ?? "f(x)";
    const variable = argmaxIntent[2] ?? "x";
    return `arg max_(${variable}) ${expr}`;
  }

  if (normalized.includes("kkt")) {
    return [
      "L(x, λ, μ) = f(x) + λ^T g(x) + μ^T h(x)",
      "∇_x L = 0",
      "g(x) <= 0, h(x) = 0",
      "λ >= 0, λ · g(x) = 0",
    ].join("\n");
  }

  if (
    normalized.includes("heat equation") ||
    normalized.includes("persamaan panas")
  ) {
    return "∂u/∂t = α ∂^2u/∂x^2";
  }

  if (
    normalized.includes("wave equation") ||
    normalized.includes("persamaan gelombang")
  ) {
    return "∂^2u/∂t^2 = c^2 ∂^2u/∂x^2";
  }

  const eigenIntent = normalized.match(
    /(?:eigenvalue|nilai eigen)(?:\s+(?:of|dari)\s+([a-z]))?$/i,
  );
  if (eigenIntent) {
    const matrix = (eigenIntent[1] ?? "A").toUpperCase();
    return `${matrix} v = λ v`;
  }

  const sumIntent = normalized.match(
    /(jumlah|sigma|sum)\s+([a-z])\s+dari\s+(.+?)\s+sampai\s+(.+)$/i,
  );
  if (sumIntent) {
    const variable = sumIntent[2] ?? "k";
    const lower = sumIntent[3]?.trim() ?? "1";
    const upper = sumIntent[4]?.trim() ?? "n";
    return `∑_(${variable}=${lower})^(${upper})`;
  }

  const productIntent = normalized.match(
    /(produk|product)\s+([a-z])\s+dari\s+(.+?)\s+sampai\s+(.+)$/i,
  );
  if (productIntent) {
    const variable = productIntent[2] ?? "k";
    const lower = productIntent[3]?.trim() ?? "1";
    const upper = productIntent[4]?.trim() ?? "n";
    return `∏_(${variable}=${lower})^(${upper})`;
  }

  return null;
};
