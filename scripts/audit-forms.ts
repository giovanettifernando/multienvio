import fs from "fs";
import path from "path";
import {
  ArrayLiteralExpression,
  CallExpression,
  Identifier,
  ImportDeclaration,
  JsxAttribute,
  JsxElement,
  JsxExpression,
  JsxOpeningElement,
  JsxSelfClosingElement,
  Node,
  ObjectBindingPattern,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
} from "ts-morph";

type FieldMeta = {
  name: string;
  label?: string;
  type?: string;
  validation: string[];
  initialValue?: string;
  mask?: string;
  dataSource?: string;
  readOnly?: string;
  visibility?: string;
  defaultValue?: string;
  notes: string[];
  source: string;
};

type FileFormMeta = {
  tempId: string;
  library: "antd" | "react-hook-form" | "native" | "manual" | "unknown";
  componentPath: string;
  title?: string;
  actions: string[];
  handlers: string[];
  submitHandlers: string[];
  fields: FieldMeta[];
  resolver?: string;
  schemas: string[];
  storeActions: string[];
  storageKeys: StorageEntry[];
  notes: string[];
};

type StorageEntry = {
  key: string;
  operation: "getItem" | "setItem" | "removeItem" | "clear" | "unknown";
  location: string;
};

type StoreAccess = {
  hook: string;
  module: string;
  actions: string[];
};

type FileAnalysis = {
  sourcePath: string;
  forms: FileFormMeta[];
  titles: string[];
  components: string[];
  schemaImports: string[];
  storeImports: string[];
  storeAccesses: StoreAccess[];
  storageUsage: StorageEntry[];
  mockImports: string[];
  dependencies: string[];
};

type RouteMeta = {
  path: string;
  file: string;
  title?: string;
  breadcrumbs: string[];
  tabs: string[];
  components: string[];
  forms: RouteFormMeta[];
  stores: string[];
  schemas: string[];
  storageKeys: StorageEntry[];
  mocks: string[];
  comments: string[];
};

type RouteFormMeta = FileFormMeta & {
  id: string;
};

type InventoryJson = {
  generatedAt: string;
  routes: Array<
    RouteMeta & {
      forms: Array<
        RouteFormMeta & {
          fields: FieldMeta[];
        }
      >;
    }
  >;
  stores: string[];
  schemas: string[];
  storageKeys: StorageEntry[];
  mocks: string[];
};

type FieldOverride = Partial<Omit<FieldMeta, "name" | "validation" | "notes" | "source">> & {
  name: string;
  validation?: string[];
  notes?: string[];
};

type FormOverride = {
  id: string;
  library?: FileFormMeta["library"];
  componentPath?: string;
  actions?: string[];
  handlers?: string[];
  submitHandlers?: string[];
  resolver?: string;
  schemas?: string[];
  storeActions?: string[];
  notes?: string[];
  fields?: FieldOverride[];
  appendFields?: FieldMeta[];
};

type RouteOverride = {
  path: string;
  title?: string;
  breadcrumbs?: string[];
  tabs?: string[];
  components?: string[];
  stores?: string[];
  schemas?: string[];
  storageKeys?: StorageEntry[];
  mocks?: string[];
  comments?: string[];
  forms?: FormOverride[];
};

type OverridesFile = {
  routes?: RouteOverride[];
};

const project = new Project({
  tsConfigFilePath: path.resolve("tsconfig.json"),
  skipAddingFilesFromTsConfig: false,
});

const cwd = process.cwd();

const sourceFiles = project.getSourceFiles([
  "app/**/*.ts",
  "app/**/*.tsx",
  "components/**/*.ts",
  "components/**/*.tsx",
  "features/**/*.ts",
  "features/**/*.tsx",
  "modules/**/*.ts",
  "modules/**/*.tsx",
  "stores/**/*.ts",
  "stores/**/*.tsx",
  "hooks/**/*.ts",
  "hooks/**/*.tsx",
  "lib/**/*.ts",
  "lib/**/*.tsx",
]);

const analyses = new Map<string, FileAnalysis>();

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function getJsxTagName(
  node: JsxElement | JsxSelfClosingElement | JsxOpeningElement,
): string {
  if (Node.isJsxElement(node)) {
    return node.getOpeningElement().getTagNameNode().getText();
  }
  return node.getTagNameNode().getText();
}

function rel(filePath: string): string {
  return toPosix(path.relative(cwd, filePath));
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function mergeUniqueStrings(current: string[], additions?: string[]): string[] {
  if (!additions?.length) return current;
  return uniqueStrings([...current, ...additions]);
}

function storageKey(current: StorageEntry): string {
  return `${current.location}:${current.key}:${current.operation}`;
}

function mergeStorageEntries(current: StorageEntry[], additions?: StorageEntry[]): StorageEntry[] {
  if (!additions?.length) return current;
  const map = new Map<string, StorageEntry>();
  current.forEach((entry) => map.set(storageKey(entry), entry));
  additions.forEach((entry) => map.set(storageKey(entry), entry));
  return Array.from(map.values());
}

function mergeFieldLists(primary: FieldMeta[], secondary: FieldMeta[]): FieldMeta[] {
  if (!secondary.length) return primary;
  const map = new Map<string, FieldMeta>();
  primary.forEach((field) => map.set(field.name, field));
  const merged = [...primary];
  secondary.forEach((field) => {
    const existing = map.get(field.name);
    if (existing) {
      const validation =
        field.validation && field.validation.length
          ? field.validation
          : existing.validation ?? [];
      const notes = uniqueStrings([...(existing.notes ?? []), ...(field.notes ?? [])]);
      Object.assign(existing, { ...field, validation, notes });
    } else {
      const nextField = {
        ...field,
        validation: field.validation ?? [],
        notes: field.notes ?? [],
      };
      merged.push(nextField);
      map.set(field.name, nextField);
    }
  });
  return merged;
}

function applyFieldOverride(field: FieldMeta, override: FieldOverride) {
  if (override.label !== undefined) field.label = override.label;
  if (override.type !== undefined) field.type = override.type;
  if (override.validation !== undefined) field.validation = override.validation;
  if (override.initialValue !== undefined) field.initialValue = override.initialValue;
  if (override.mask !== undefined) field.mask = override.mask;
  if (override.dataSource !== undefined) field.dataSource = override.dataSource;
  if (override.readOnly !== undefined) field.readOnly = override.readOnly;
  if (override.visibility !== undefined) field.visibility = override.visibility;
  if (override.defaultValue !== undefined) field.defaultValue = override.defaultValue;
  if (override.notes?.length) {
    field.notes = uniqueStrings([...(field.notes ?? []), ...override.notes]);
  }
}

function loadOverrides(): OverridesFile {
  const overridePath = path.join(cwd, "docs", "forms-overrides.json");
  if (!fs.existsSync(overridePath)) {
    return { routes: [] };
  }
  try {
    const raw = fs.readFileSync(overridePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { routes: [] };
    }
    return parsed as OverridesFile;
  } catch (error) {
    console.warn("Não foi possível ler docs/forms-overrides.json:", error);
    return { routes: [] };
  }
}

function isAntdFormModule(module: string): boolean {
  return (
    module === "antd" ||
    module.startsWith("antd/") ||
    module.startsWith("antd/es/") ||
    module.startsWith("antd/lib/")
  );
}

function getImportAliasMap(sourceFile: SourceFile) {
  const map = new Map<string, { module: string; importDecl: ImportDeclaration }>();
  for (const decl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    const namedImports = decl.getNamedImports();
    if (namedImports.length) {
      for (const namedImport of namedImports) {
        const alias = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
        map.set(alias, { module: moduleSpecifier, importDecl: decl });
      }
    }
    const defaultImport = decl.getDefaultImport();
    if (defaultImport) {
      map.set(defaultImport.getText(), { module: moduleSpecifier, importDecl: decl });
    }
    const namespaceImport = decl.getNamespaceImport();
    if (namespaceImport) {
      map.set(namespaceImport.getText(), { module: moduleSpecifier, importDecl: decl });
    }
  }
  return map;
}

function extractJsxAttribute(
  element: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): JsxAttribute | undefined {
  const attr = element.getAttribute(name);
  return Node.isJsxAttribute(attr) ? attr : undefined;
}

function literalFromExpression(expr: Node | undefined): string | undefined {
  if (!expr) return undefined;
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.getLiteralValue();
  }
  if (Node.isNumericLiteral(expr)) {
    return expr.getLiteralValue().toString();
  }
  if (Node.isIdentifier(expr)) {
    return expr.getText();
  }
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getText();
  }
  if (Node.isCallExpression(expr)) {
    return expr.getText();
  }
  if (Node.isArrayLiteralExpression(expr)) {
    return expr
      .getElements()
      .map((el) => literalFromExpression(el) ?? el.getText())
      .join(".");
  }
  if (Node.isObjectLiteralExpression(expr)) {
    return expr.getText();
  }
  return expr.getText();
}

function literalFromInitializer(attr?: JsxAttribute): string | undefined {
  if (!attr) return undefined;
  const initializer = attr.getInitializer();
  if (!initializer) return "";
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralValue();
  }
  if (Node.isJsxExpression(initializer)) {
    return literalFromExpression(initializer.getExpression());
  }
  return initializer.getText();
}

function extractValidationFromObject(obj: ObjectLiteralExpression): string[] {
  const validations: string[] = [];
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) {
      continue;
    }
    const name = prop.getNameNode().getText();
    const initializer =
      Node.isPropertyAssignment(prop) || Node.isShorthandPropertyAssignment(prop)
        ? prop.getInitializer()
        : undefined;
    const value = literalFromExpression(initializer);
    switch (name) {
      case "required":
        validations.push(value && value !== "true" ? `required (${value})` : "required");
        break;
      case "min":
      case "max":
      case "len":
      case "minLength":
      case "maxLength":
        validations.push(`${name}: ${value ?? "n/a"}`);
        break;
      case "pattern":
        validations.push(`pattern: ${value ?? "n/a"}`);
        break;
      case "enum":
        validations.push(`enum: ${value ?? "n/a"}`);
        break;
      case "email":
        validations.push("email");
        break;
      case "validator":
        validations.push("custom-validator");
        break;
      default:
        validations.push(`${name}: ${value ?? "n/a"}`);
    }
  }
  return validations;
}

function extractValidations(attr?: JsxAttribute): string[] {
  if (!attr) return [];
  const initializer = attr.getInitializer();
  if (!initializer) return [];
  if (Node.isJsxExpression(initializer)) {
    const expr = initializer.getExpression();
    if (!expr) return [];
    if (Node.isArrayLiteralExpression(expr)) {
      return expr
        .getElements()
        .flatMap((element) => {
          if (Node.isObjectLiteralExpression(element)) {
            return extractValidationFromObject(element);
          }
          return literalFromExpression(element) ? [`rule: ${literalFromExpression(element)}`] : [];
        })
        .filter(Boolean);
    }
    if (Node.isObjectLiteralExpression(expr)) {
      return extractValidationFromObject(expr);
    }
    const literal = literalFromExpression(expr);
    return literal ? [literal] : [];
  }
  return [initializer.getText()];
}

function extractValidationsFromObjectLiteral(obj: ObjectLiteralExpression): string[] {
  return extractValidationFromObject(obj);
}

function resolveTargetFile(importDecl: ImportDeclaration): SourceFile | undefined {
  try {
    return importDecl.getModuleSpecifierSourceFile();
  } catch (error) {
    return undefined;
  }
}

function collectJsxText(element: JsxElement): string | undefined {
  const raw = element
    .getChildren()
    .filter((child) => child.getKind() === SyntaxKind.JsxText)
    .map((child) => child.getText().trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (raw) return raw;

  const expressions = element
    .getChildrenOfKind(SyntaxKind.JsxExpression)
    .map((expr) => literalFromExpression(expr.getExpression()))
    .filter(Boolean);

  if (expressions.length) {
    return expressions.join(" ");
  }

  return undefined;
}

function collectComponentNames(sourceFile: SourceFile): string[] {
  const names = new Set<string>();
  sourceFile.forEachDescendant((node) => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      const tagName = getJsxTagName(node);
      if (/^[A-Z]/.test(tagName.replace(/^.*\./, ""))) {
        names.add(tagName);
      }
    }
  });
  return Array.from(names);
}

function collectTitles(sourceFile: SourceFile): string[] {
  const titles = new Set<string>();
  sourceFile.forEachDescendant((node) => {
    if (Node.isJsxElement(node)) {
      const opening = node.getOpeningElement();
      const tagText = getJsxTagName(opening);
      if (
        tagText === "Typography.Title" ||
        tagText === "Title" ||
        tagText === "PageHeader" ||
        tagText === "h1"
      ) {
        const text = collectJsxText(node);
        if (text) titles.add(text);
      }
    } else if (Node.isVariableDeclaration(node)) {
      const name = node.getName();
      const initializer = node.getInitializer();
      if (name === "metadata" && initializer && Node.isObjectLiteralExpression(initializer)) {
        const obj = node.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
        const titleProp = obj?.getProperty("title");
        if (titleProp && Node.isPropertyAssignment(titleProp)) {
          const value = literalFromExpression(titleProp.getInitializer());
          if (value) titles.add(value);
        }
      }
    }
  });
  return Array.from(titles);
}

function collectSchemas(importMap: Map<string, { module: string }>): string[] {
  const local = new Set<string>();
  for (const { module: moduleName } of importMap.values()) {
    if (/validation|schema|schemas/i.test(moduleName)) {
      local.add(moduleName);
    }
  }
  return Array.from(local);
}

function collectStores(importMap: Map<string, { module: string }>): string[] {
  const local = new Set<string>();
  for (const { module: moduleName } of importMap.values()) {
    if (/stores?\//.test(moduleName) || /use.*Store/.test(moduleName) || /store\//.test(moduleName)) {
      local.add(moduleName);
    }
  }
  return Array.from(local);
}

function collectMocks(importMap: Map<string, { module: string }>): string[] {
  const local = new Set<string>();
  for (const { module: moduleName } of importMap.values()) {
    if (/mocks?\//.test(moduleName)) {
      local.add(moduleName);
    }
  }
  return Array.from(local);
}

function collectStorageUsage(sourceFile: SourceFile): StorageEntry[] {
  const entries: StorageEntry[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const exprText = expression.getExpression().getText();
        if (exprText === "localStorage" || exprText === "sessionStorage") {
          const method = expression.getName() as StorageEntry["operation"];
          const keyArg = node.getArguments()[0];
          const key = literalFromExpression(keyArg) ?? "n/a";
          entries.push({
            key,
            operation: method ?? "n/a",
            location: rel(node.getSourceFile().getFilePath()),
          });
        }
      }
    }
  });
  return entries;
}

function collectStoreAccesses(
  sourceFile: SourceFile,
  importMap: Map<string, { module: string }>,
): StoreAccess[] {
  const accesses: StoreAccess[] = [];
  const storeHooks = new Set(
    Array.from(importMap.entries())
      .filter(([alias, info]) => /stores?\//.test(info.module) || /store\//.test(info.module))
      .map(([alias]) => alias),
  );

  if (!storeHooks.size) {
    return accesses;
  }

  sourceFile.forEachDescendant((node) => {
    if (!Node.isVariableDeclaration(node)) return;
    const initializer = node.getInitializer();
    if (!Node.isCallExpression(initializer)) return;
    const expression = initializer.getExpression();
    if (!Node.isIdentifier(expression)) return;
    const hookName = expression.getText();
    if (!storeHooks.has(hookName)) return;

    const moduleName = importMap.get(hookName)?.module ?? "n/a";
    const binding = node.getNameNode();
    if (Node.isObjectBindingPattern(binding)) {
      const actions = binding
        .getElements()
        .map((el) => el.getNameNode().getText())
        .filter(Boolean);
      accesses.push({ hook: hookName, module: moduleName, actions });
    } else if (Node.isIdentifier(binding)) {
      accesses.push({ hook: hookName, module: moduleName, actions: [binding.getText()] });
    } else {
      accesses.push({ hook: hookName, module: moduleName, actions: [] });
    }
  });

  return accesses;
}

function inferFieldType(fieldElement?: JsxElement | JsxSelfClosingElement): string | undefined {
  if (!fieldElement) return undefined;
  const opening =
    Node.isJsxElement(fieldElement) ? fieldElement.getOpeningElement() : fieldElement;
  const tagName = getJsxTagName(opening);
  return tagName;
}

function extractFormFieldsFromAntdForm(
  formElement: JsxElement | JsxSelfClosingElement,
  importMap: Map<string, { module: string }>,
): FieldMeta[] {
  const fields: FieldMeta[] = [];
  const allFormItems: (JsxElement | JsxSelfClosingElement)[] = [];

  if (Node.isJsxElement(formElement)) {
    formElement.forEachDescendant((node) => {
      if (Node.isJsxElement(node)) {
        if (getJsxTagName(node) === "Form.Item") {
          allFormItems.push(node);
        }
      } else if (Node.isJsxSelfClosingElement(node)) {
        if (getJsxTagName(node) === "Form.Item") {
          allFormItems.push(node);
        }
      }
    });
  } else if (Node.isJsxSelfClosingElement(formElement)) {
    if (getJsxTagName(formElement) === "Form.Item") {
      allFormItems.push(formElement);
    }
  }

  allFormItems.forEach((item, index) => {
    const opening = Node.isJsxElement(item) ? item.getOpeningElement() : item;
    const name = literalFromInitializer(extractJsxAttribute(opening, "name")) ?? `field-${index + 1}`;
    const label = literalFromInitializer(extractJsxAttribute(opening, "label"));
    const initialValue = literalFromInitializer(extractJsxAttribute(opening, "initialValue"));
    const tooltip = literalFromInitializer(extractJsxAttribute(opening, "tooltip"));
    const hidden = literalFromInitializer(extractJsxAttribute(opening, "hidden"));
    const dependenciesAttr = literalFromInitializer(extractJsxAttribute(opening, "dependencies"));

    const validations = extractValidations(extractJsxAttribute(opening, "rules"));

    let fieldTag: JsxElement | JsxSelfClosingElement | undefined;
    if (Node.isJsxElement(item)) {
      const jsxElements = item.getChildrenOfKind(SyntaxKind.JsxElement);
      const selfClosing = item.getChildrenOfKind(SyntaxKind.JsxSelfClosingElement);
      const descendants: Array<JsxElement | JsxSelfClosingElement> = [...jsxElements, ...selfClosing];

      fieldTag = descendants.find((child) => {
        const tagName = getJsxTagName(child);
        return tagName !== "Form.Item" && tagName !== "FormError";
      });
      if (!fieldTag) {
        const direct = item.getChildAtIndex(1);
        if (Node.isJsxElement(direct) || Node.isJsxSelfClosingElement(direct)) {
          fieldTag = direct;
        }
      }
    }

    const type = inferFieldType(fieldTag);

    let dataSource: string | undefined;
    let mask: string | undefined;
    let readOnly: string | undefined;

    if (fieldTag) {
      const openingField = Node.isJsxElement(fieldTag) ? fieldTag.getOpeningElement() : fieldTag;
      dataSource =
        literalFromInitializer(extractJsxAttribute(openingField, "options")) ??
        literalFromInitializer(extractJsxAttribute(openingField, "dataSource")) ??
        undefined;
      mask =
        literalFromInitializer(extractJsxAttribute(openingField, "formatter")) ??
        literalFromInitializer(extractJsxAttribute(openingField, "mask")) ??
        undefined;
      readOnly =
        literalFromInitializer(extractJsxAttribute(openingField, "readOnly")) ??
        literalFromInitializer(extractJsxAttribute(openingField, "disabled")) ??
        undefined;
    }

    const visibility = hidden === "true" ? "hidden" : dependenciesAttr;

    const notes = [];
    if (tooltip) notes.push(`tooltip: ${tooltip}`);

    fields.push({
      name,
      label,
      type,
      validation: validations,
      initialValue,
      mask,
      dataSource,
      readOnly,
      visibility,
      notes,
      defaultValue: undefined,
      source: rel(opening.getSourceFile().getFilePath()),
    });
  });

  return fields;
}

function extractControllerFields(
  root: Node,
  importMap: Map<string, { module: string }>,
): FieldMeta[] {
  const fields: FieldMeta[] = [];
  let counter = 0;
  root.forEachDescendant((node) => {
    if (!(Node.isJsxSelfClosingElement(node) || Node.isJsxElement(node))) return;
    const tagName = getJsxTagName(node as JsxElement | JsxSelfClosingElement);
    if (tagName !== "Controller") return;
    const opening = Node.isJsxElement(node) ? node.getOpeningElement() : node;
    counter += 1;
    const name =
      literalFromInitializer(extractJsxAttribute(opening, "name")) ?? `field-${counter}`;

    let renderTarget: JsxElement | JsxSelfClosingElement | undefined;
    const renderAttr = extractJsxAttribute(opening, "render");
    if (renderAttr) {
      const initializer = renderAttr.getInitializer();
      if (Node.isJsxExpression(initializer)) {
        const expr = initializer.getExpression();
        if (expr && Node.isArrowFunction(expr)) {
          const body = expr.getBody();
          if (Node.isJsxElement(body) || Node.isJsxSelfClosingElement(body)) {
            renderTarget = body;
          } else if (Node.isParenthesizedExpression(body)) {
            const inner = body.getExpression();
            if (Node.isJsxElement(inner) || Node.isJsxSelfClosingElement(inner)) {
              renderTarget = inner;
            }
          }
        }
      }
    }

    const fieldType = renderTarget ? inferFieldType(renderTarget) : undefined;
    const validations = extractValidations(
      extractJsxAttribute(opening, "rules") ?? undefined,
    );
    const defaultValue = literalFromInitializer(extractJsxAttribute(opening, "defaultValue"));

    fields.push({
      name,
      label: undefined,
      type: fieldType,
      validation: validations,
      defaultValue,
      mask: undefined,
      dataSource: undefined,
      readOnly: undefined,
      visibility: undefined,
      initialValue: undefined,
      notes: [],
      source: rel(opening.getSourceFile().getFilePath()),
    });
  });
  return fields;
}

function collectFormActions(element: JsxElement | JsxSelfClosingElement): {
  actions: string[];
  handlers: string[];
  submitHandlers: string[];
} {
  const opening = Node.isJsxElement(element) ? element.getOpeningElement() : element;
  const actionAttrs = ["onFinish", "onSubmit", "onReset", "onValuesChange"];
  const actions: string[] = [];
  const handlers: string[] = [];
  const submitHandlers: string[] = [];

  actionAttrs.forEach((attrName) => {
    const attr = extractJsxAttribute(opening, attrName);
    if (!attr) return;
    const value = literalFromInitializer(attr);
    if (value) {
      actions.push(`${attrName}: ${value}`);
      if (attrName === "onFinish" || attrName === "onSubmit") {
        submitHandlers.push(value);
      } else {
        handlers.push(`${attrName}: ${value}`);
      }
    }
  });

  if (Node.isJsxElement(element)) {
    element.forEachDescendant((node) => {
      if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
        const tag = getJsxTagName(node);
        if (tag === "Button") {
          const htmlType = literalFromInitializer(extractJsxAttribute(node, "htmlType"));
          const onClick = literalFromInitializer(extractJsxAttribute(node, "onClick"));
          if (htmlType === "submit") {
            actions.push(`Button submit${onClick ? ` -> ${onClick}` : ""}`);
            if (onClick) submitHandlers.push(onClick);
          } else if (htmlType === "reset") {
            actions.push("Button reset");
          }
        }
      }
    });
  }

  return { actions, handlers, submitHandlers };
}

function analyzeSourceFile(sourceFile: SourceFile): FileAnalysis {
  const filePath = rel(sourceFile.getFilePath());
  if (analyses.has(filePath)) {
    return analyses.get(filePath)!;
  }

  const importMap = getImportAliasMap(sourceFile);
  const schemas = collectSchemas(importMap);
  const stores = collectStores(importMap);
  const mocks = collectMocks(importMap);
  const storageUsage = collectStorageUsage(sourceFile);
  const storeAccesses = collectStoreAccesses(sourceFile, importMap);

  const components = collectComponentNames(sourceFile);
  const titles = collectTitles(sourceFile);

  const forms: FileFormMeta[] = [];

  const antdFormAliases = Array.from(importMap.entries()).filter(
    ([alias, info]) => alias === "Form" && isAntdFormModule(info.module),
  );
  const hasAntdFormImport = antdFormAliases.length > 0;
  const hasControllerImport = importMap.has("Controller");
  const hasUseFormImport = importMap.has("useForm");

  sourceFile.forEachDescendant((node) => {
    if (!(Node.isJsxElement(node) || Node.isJsxSelfClosingElement(node))) return;
    const tagText = getJsxTagName(node);

    if (tagText === "Form") {
      const library = hasAntdFormImport
        ? "antd"
        : hasUseFormImport
          ? "react-hook-form"
          : "manual";
      const baseFields = extractFormFieldsFromAntdForm(node, importMap);
      const controllerFields = hasControllerImport ? extractControllerFields(node, importMap) : [];
      const fields = mergeFieldLists(baseFields, controllerFields);
      const { actions, handlers, submitHandlers } = collectFormActions(node);
      const formIndex = forms.length + 1;
      forms.push({
        tempId: `form-${formIndex}`,
        library,
        componentPath: filePath,
        fields,
        actions,
        handlers,
        submitHandlers,
        schemas,
        resolver: undefined,
        storeActions: storeAccesses.flatMap((access) => access.actions),
        storageKeys: storageUsage,
        notes: [],
      });
    } else if (tagText === "form") {
      const { actions, handlers, submitHandlers } = collectFormActions(node);
      const controllerFields = hasControllerImport ? extractControllerFields(node, importMap) : [];

      let resolver: string | undefined;

      if (hasUseFormImport) {
        const useFormCalls = sourceFile
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .filter((call) => {
            const expr = call.getExpression();
            return Node.isIdentifier(expr) && expr.getText() === "useForm";
          });

        for (const call of useFormCalls) {
          const arg = call.getArguments()[0];
          if (Node.isObjectLiteralExpression(arg)) {
            const resolverProp = arg.getProperty("resolver");
            if (resolverProp && Node.isPropertyAssignment(resolverProp)) {
              resolver = literalFromExpression(resolverProp.getInitializer());
            }
          }
        }
      }

      const formIndex = forms.length + 1;
      forms.push({
        tempId: `form-${formIndex}`,
        library: hasUseFormImport ? "react-hook-form" : "native",
        componentPath: filePath,
        fields: controllerFields,
        actions,
        handlers,
        submitHandlers,
        schemas,
        resolver,
        storeActions: storeAccesses.flatMap((access) => access.actions),
        storageKeys: storageUsage,
        notes: [],
      });
    }
  });

  const dependencies = sourceFile
    .getImportDeclarations()
    .map((decl) => resolveTargetFile(decl))
    .filter((dep): dep is SourceFile => !!dep)
    .map((dep) => rel(dep.getFilePath()));

  const analysis: FileAnalysis = {
    sourcePath: filePath,
    forms,
    titles,
    components,
    schemaImports: schemas,
    storeImports: stores,
    storeAccesses,
    storageUsage,
    mockImports: mocks,
    dependencies,
  };

  analyses.set(filePath, analysis);
  return analysis;
}

function getRoutePathFromFile(filePath: string): string {
  const relative = filePath.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
  const segments = relative.split("/").filter(Boolean);
  const routeSegments = segments
    .filter((segment) => !segment.startsWith("(") && !segment.endsWith(")"))
    .map((segment) => segment.replace(/^default$/, "").replace(/\(.*\)/g, ""));
  const pathStr = "/" + routeSegments.join("/");
  return pathStr === "/" ? "/" : pathStr.replace(/\/+/g, "/");
}

function isAdminRoute(routePath: string): boolean {
  return routePath.startsWith("/admin");
}

function discoverRoutes(): RouteMeta[] {
  const pageFiles = sourceFiles.filter((file) => file.getBaseName() === "page.tsx");
  const routes: RouteMeta[] = [];

  for (const pageFile of pageFiles) {
    const filePath = rel(pageFile.getFilePath());
    if (!filePath.startsWith("app/")) continue;
    const routePath = getRoutePathFromFile(filePath);

    const visited = new Set<string>();
    const queue: string[] = [filePath];

    const aggregatedForms: FileFormMeta[] = [];
    const aggregatedStores = new Set<string>();
    const aggregatedSchemas = new Set<string>();
    const aggregatedComponents = new Set<string>();
    const aggregatedStorage = new Map<string, StorageEntry>();
    const aggregatedMocks = new Set<string>();
    const comments: string[] = [];

    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const source = project.getSourceFile(path.resolve(current));
      if (!source) continue;
      const analysis = analyzeSourceFile(source);

      aggregatedForms.push(...analysis.forms);
      analysis.storeImports.forEach((store) => aggregatedStores.add(store));
      analysis.schemaImports.forEach((schema) => aggregatedSchemas.add(schema));
      analysis.components.forEach((component) => aggregatedComponents.add(component));
      analysis.mockImports.forEach((mock) => aggregatedMocks.add(mock));
      analysis.storageUsage.forEach((entry) => {
        const key = `${entry.location}:${entry.key}:${entry.operation}`;
        aggregatedStorage.set(key, entry);
      });

      const allowedPrefixes = [
        "components/",
        "features/",
        "modules/",
        "app/",
        "src/components/",
        "src/features/",
        "src/modules/",
      ];
      analysis.dependencies.forEach((dep) => {
        if (!visited.has(dep) && allowedPrefixes.some((prefix) => dep.startsWith(prefix))) {
          queue.push(dep);
        }
      });
    }

    const analysis = analyzeSourceFile(pageFile);
    const title = analysis.titles[0];

    const routeForms: RouteFormMeta[] = aggregatedForms.map((formMeta, index) => {
      const slug = routePath.replace(/[\/[\]]/g, "-").replace(/^-+|-+$/g, "") || "root";
      const formId = `${slug}-${index + 1}`;
      return {
        ...formMeta,
        id: `form-${formId}`,
      };
    });

    if (!routeForms.length) {
      comments.push("Nenhum formulário detectado automaticamente.");
    }

    const routeMeta: RouteMeta = {
      path: routePath,
      file: filePath,
      title,
      breadcrumbs: [],
      tabs: [],
      components: Array.from(aggregatedComponents),
      forms: routeForms,
      stores: Array.from(aggregatedStores),
      schemas: Array.from(aggregatedSchemas),
      storageKeys: Array.from(aggregatedStorage.values()),
      mocks: Array.from(aggregatedMocks),
      comments,
    };

    routes.push(routeMeta);
  }

  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

function applyOverridesToRoutes(routes: RouteMeta[], overrides: OverridesFile): RouteMeta[] {
  if (!overrides.routes?.length) return routes;
  const routeMap = new Map(routes.map((route) => [route.path, route]));

  for (const override of overrides.routes) {
    const route = routeMap.get(override.path);
    if (!route) continue;

    if (override.title) route.title = override.title;
    if (override.breadcrumbs) route.breadcrumbs = override.breadcrumbs;
    if (override.tabs) route.tabs = override.tabs;
    if (override.components) route.components = mergeUniqueStrings(route.components, override.components);
    if (override.stores) route.stores = mergeUniqueStrings(route.stores, override.stores);
    if (override.schemas) route.schemas = mergeUniqueStrings(route.schemas, override.schemas);
    if (override.mocks) route.mocks = mergeUniqueStrings(route.mocks, override.mocks);
    if (override.comments) route.comments = mergeUniqueStrings(route.comments, override.comments);
    if (override.storageKeys) {
      route.storageKeys = mergeStorageEntries(route.storageKeys, override.storageKeys);
    }

    if (override.forms?.length) {
      const formMap = new Map(route.forms.map((form) => [form.id, form]));
      for (const formOverride of override.forms) {
        let form = formMap.get(formOverride.id);
        if (!form) {
          form = {
            tempId: formOverride.id,
            id: formOverride.id,
            library: formOverride.library ?? "manual",
            componentPath: formOverride.componentPath ?? route.file,
            fields: [],
            actions: [],
            handlers: [],
            submitHandlers: [],
            schemas: [],
            storeActions: [],
            storageKeys: [],
            notes: [],
          } as RouteFormMeta;
          route.forms.push(form);
          formMap.set(form.id, form);
        }

        if (formOverride.library) form.library = formOverride.library;
        if (formOverride.componentPath) form.componentPath = formOverride.componentPath;
        if (formOverride.actions) form.actions = mergeUniqueStrings(form.actions, formOverride.actions);
        if (formOverride.handlers) form.handlers = mergeUniqueStrings(form.handlers, formOverride.handlers);
        if (formOverride.submitHandlers)
          form.submitHandlers = mergeUniqueStrings(form.submitHandlers, formOverride.submitHandlers);
        if (formOverride.resolver) form.resolver = formOverride.resolver;
        if (formOverride.schemas) form.schemas = mergeUniqueStrings(form.schemas, formOverride.schemas);
        if (formOverride.storeActions)
          form.storeActions = mergeUniqueStrings(form.storeActions, formOverride.storeActions);
        if (formOverride.notes)
          form.notes = mergeUniqueStrings(form.notes, formOverride.notes);
        if (formOverride.fields?.length) {
          const fieldMap = new Map(form.fields.map((field) => [field.name, field]));
          formOverride.fields.forEach((fieldOverride) => {
            if (!fieldOverride.name) return;
            let field = fieldMap.get(fieldOverride.name);
            if (!field) {
              field = {
                name: fieldOverride.name,
                label: fieldOverride.label,
                type: fieldOverride.type,
                validation: fieldOverride.validation ?? [],
                initialValue: fieldOverride.initialValue,
                mask: fieldOverride.mask,
                dataSource: fieldOverride.dataSource,
                readOnly: fieldOverride.readOnly,
                visibility: fieldOverride.visibility,
                notes: fieldOverride.notes ?? [],
                defaultValue: fieldOverride.defaultValue,
                source: form.componentPath,
              };
              form.fields.push(field);
              fieldMap.set(field.name, field);
            } else {
              applyFieldOverride(field, fieldOverride);
            }
          });
        }

        if (formOverride.appendFields?.length) {
          form.fields = mergeFieldLists(form.fields, formOverride.appendFields);
        }
      }

      route.forms.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  return routes;
}

function normalizeRoutes(routes: RouteMeta[]): RouteMeta[] {
  routes.forEach((route) => {
    route.forms.forEach((form) => {
      if (!form.library || form.library === "unknown") {
        form.library = "manual";
      }
      form.fields = form.fields.map((field, index) => {
        const normalized: FieldMeta = {
          ...field,
          name: field.name || `field-${index + 1}`,
          label: field.label ?? undefined,
          type: field.type ?? undefined,
          validation: field.validation ?? [],
          initialValue: field.initialValue ?? undefined,
          mask: field.mask ?? undefined,
          dataSource: field.dataSource ?? undefined,
          readOnly: field.readOnly ?? undefined,
          visibility: field.visibility ?? undefined,
          defaultValue: field.defaultValue ?? undefined,
          notes: field.notes ?? [],
        };
        return normalized;
      });
    });
  });
  return routes;
}

function preserveGeneratedAt(jsonPath: string, next: InventoryJson): InventoryJson {
  if (!fs.existsSync(jsonPath)) {
    return next;
  }
  try {
    const previousRaw = fs.readFileSync(jsonPath, "utf8");
    const previous = JSON.parse(previousRaw) as InventoryJson;
    const { generatedAt: prevGeneratedAt, ...prevRest } = previous as Omit<InventoryJson, "generatedAt"> & {
      generatedAt?: string;
    };
    const nextClone = JSON.parse(JSON.stringify(next)) as InventoryJson;
    delete (nextClone as Partial<InventoryJson>).generatedAt;
    if (JSON.stringify(nextClone) === JSON.stringify(prevRest) && prevGeneratedAt) {
      next.generatedAt = prevGeneratedAt;
    }
  } catch {
    // mantém generatedAt calculado
  }
  return next;
}

function renderMarkdown(routes: RouteMeta[]): string {
  const lines: string[] = [];

  const adminRoutes = routes.filter((route) => isAdminRoute(route.path));
  const userRoutes = routes.filter((route) => !isAdminRoute(route.path));

  const globalSchemas = new Set<string>();
  const globalStores = new Set<string>();
  const globalMocks = new Set<string>();
  const globalStorage = new Map<string, StorageEntry>();

  routes.forEach((route) => {
    route.schemas.forEach((schema) => globalSchemas.add(schema));
    route.stores.forEach((store) => globalStores.add(store));
    route.mocks.forEach((mock) => globalMocks.add(mock));
    route.storageKeys.forEach((entry) => {
      const key = `${entry.location}:${entry.key}:${entry.operation}`;
      globalStorage.set(key, entry);
    });
  });

  lines.push("# Inventário de Telas e Formulários — Envio Legal");
  lines.push("");
  lines.push("## Sumário");
  lines.push("- Visão Geral");
  lines.push("- Matriz de Rotas");
  lines.push("- Telas do Usuário (/)");
  lines.push("- Telas Administrativas (/admin)");
  lines.push("- Enums & Schemas Globais");
  lines.push("- Stores & Persistência");
  lines.push("- Mocks & Pontos a Eliminar");
  lines.push("- Itens de Integração Prioritários");
  lines.push("");
  lines.push("## Visão Geral");
  lines.push(
    "Inventário automatizado das rotas do App Router (Next.js) com foco nos formulários Ant Design e React Hook Form. Inclui dependências de validação (Zod/Yup), stores Zustand, persistência local e mocks identificados pelo analisador estático.",
  );
  lines.push("");

  lines.push("## Matriz de Rotas");
  lines.push(
    "| Rota | Arquivo | Possui Form | FormIds | Componentes-chave |",
  );
  lines.push("|------|---------|-------------|---------|-------------------|");
  routes.forEach((route) => {
    const hasForm = route.forms.length > 0 ? "sim" : "não";
    const formIds = route.forms.map((form) => form.id).join(", ") || "-";
    const components =
      route.components.length > 0 ? route.components.slice(0, 4).join(", ") : "-";
    lines.push(
      `| ${route.path} | ${route.file} | ${hasForm} | ${formIds} | ${components} |`,
    );
  });
  lines.push("");

  lines.push("## Telas do Usuário (/)");
  if (!userRoutes.length) {
    lines.push("_Nenhuma rota de usuário encontrada._");
  } else {
    userRoutes.forEach((route) => {
      renderRouteSection(lines, route);
    });
  }
  lines.push("");

  lines.push("## Telas Administrativas (/admin)");
  if (!adminRoutes.length) {
    lines.push("_Nenhuma rota administrativa encontrada._");
  } else {
    adminRoutes.forEach((route) => {
      renderRouteSection(lines, route);
    });
  }
  lines.push("");

  lines.push("## Enums & Schemas Globais");
  if (!globalSchemas.size) {
    lines.push("- Nenhum schema importado foi detectado.");
  } else {
    Array.from(globalSchemas)
      .sort()
      .forEach((schema) => {
        lines.push(`- ${schema}`);
      });
  }
  lines.push("");

  lines.push("## Stores & Persistência");
  if (!globalStores.size && !globalStorage.size) {
    lines.push("- Nenhum uso de Zustand ou persistência local detectado.");
  } else {
    if (globalStores.size) {
      lines.push("**Stores Zustand & Hooks relacionados**");
      Array.from(globalStores)
        .sort()
        .forEach((store) => {
          lines.push(`- ${store}`);
        });
    }
    if (globalStorage.size) {
      lines.push("**Persistência local (localStorage/sessionStorage)**");
      Array.from(globalStorage.values()).forEach((entry) => {
        lines.push(
          `- ${entry.operation} :: ${entry.key} (${entry.location})`,
        );
      });
    }
  }
  lines.push("");

  lines.push("## Mocks & Pontos a Eliminar");
  if (!globalMocks.size) {
    lines.push("- Nenhum mock importado foi encontrado automaticamente.");
  } else {
    Array.from(globalMocks)
      .sort()
      .forEach((mock) => {
        lines.push(`- ${mock}`);
      });
  }
  lines.push("");

  lines.push("## Itens de Integração Prioritários");
  lines.push(
    "- Revisar formulários com validações não mapeadas automaticamente (campos sem metadados).",
  );
  lines.push(
    "- Validar consistência dos schemas Zod/Yup identificados com o backend antes de remover mocks.",
  );
  lines.push(
    "- Garantir que ações de stores listadas estejam sincronizadas entre rotas de usuário e administrativas.",
  );
  lines.push(
    "- Mapear dependências externas (CEP, mascaras) manualmente onde o analisador não identificou.",
  );
  lines.push("");

  return lines.join("\n");
}

function renderRouteSection(lines: string[], route: RouteMeta) {
  lines.push(`### ${route.path}`);
  lines.push(`**Arquivo:** \`${route.file}\``);
  const components =
    route.components.length > 0 ? route.components.join(", ") : "Sem componentes destacados";
  lines.push(`**Componentes:** ${components}`);
  if (route.stores.length) {
    lines.push(`**Store(s):** ${route.stores.join(", ")}`);
  }
  if (route.schemas.length) {
    lines.push(`**Schemas:** ${route.schemas.join(", ")}`);
  }
  lines.push("");

  route.forms.forEach((form) => {
    lines.push(`#### Formulário ${form.id}`);
    lines.push(`- Biblioteca: ${form.library}`);
    lines.push(`- Componente: \`${form.componentPath}\``);
    if (form.resolver) {
      lines.push(`- Resolver/Schema: ${form.resolver}`);
    }
    if (form.actions.length) {
      lines.push(`- Ações: ${form.actions.join("; ")}`);
    }
    if (form.storeActions.length) {
      lines.push(`- Store actions: ${form.storeActions.join(", ")}`);
    }
    if (form.storageKeys.length) {
      const storage = form.storageKeys
        .map((entry) => `${entry.operation}:${entry.key}`)
        .join(", ");
      lines.push(`- Persistência: ${storage}`);
    }
    if (form.notes.length) {
      lines.push(`- Observações: ${form.notes.join("; ")}`);
    }
    lines.push("");
    lines.push(
      "| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |",
    );
    lines.push(
      "|-----------|-------|------|------------|---------|------|------------|-------------|------------|",
    );
    if (!form.fields.length) {
      lines.push(`| - | - | - | - | - | - | - | - | - |`);
    } else {
      form.fields.forEach((field) => {
        lines.push(
          `| ${field.name || "-"} | ${field.label ?? "-"} | ${field.type ?? "-"} | ${
            field.validation.length ? field.validation.join(", ") : "-"
          } | ${field.initialValue ?? field.defaultValue ?? "-"} | ${field.mask ?? "-"} | ${
            field.dataSource ?? "-"
          } | ${field.readOnly ?? "-"} | ${field.visibility ?? "-"} |`,
        );
      });
    }
    lines.push("");
  });

  if (route.storageKeys.length) {
    lines.push("**Persistência detectada**");
    route.storageKeys.forEach((entry) => {
      lines.push(`- ${entry.operation} :: ${entry.key} (${entry.location})`);
    });
    lines.push("");
  }

  if (route.mocks.length) {
    lines.push("**Mocks**");
    route.mocks.forEach((mock) => lines.push(`- ${mock}`));
    lines.push("");
  }

  if (route.comments.length) {
    lines.push("_Observações:_");
    route.comments.forEach((comment) => lines.push(`- ${comment}`));
    lines.push("");
  }
}

function buildInventoryJson(routes: RouteMeta[]): InventoryJson {
  const stores = new Set<string>();
  const schemas = new Set<string>();
  const mocks = new Set<string>();
  const storage = new Map<string, StorageEntry>();

  routes.forEach((route) => {
    route.stores.forEach((store) => stores.add(store));
    route.schemas.forEach((schema) => schemas.add(schema));
    route.mocks.forEach((mock) => mocks.add(mock));
    route.storageKeys.forEach((entry) => {
      const key = `${entry.location}:${entry.key}:${entry.operation}`;
      storage.set(key, entry);
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    routes: routes.map((route) => ({
      ...route,
      forms: route.forms.map((form) => ({
        ...form,
        fields: form.fields.map((field) => ({
          ...field,
        })),
      })),
    })),
    stores: Array.from(stores),
    schemas: Array.from(schemas),
    storageKeys: Array.from(storage.values()),
    mocks: Array.from(mocks),
  };
}

function main() {
  const overrides = loadOverrides();
  const routes = normalizeRoutes(applyOverridesToRoutes(discoverRoutes(), overrides));
  const docsDir = path.join(cwd, "docs");
  ensureDir(docsDir);

  const markdown = renderMarkdown(routes);
  const jsonPath = path.join(docsDir, "forms-inventory.json");
  const json = preserveGeneratedAt(jsonPath, buildInventoryJson(routes));

  fs.writeFileSync(path.join(docsDir, "forms-inventory.md"), markdown, "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf8");

  console.log("Inventário atualizado em docs/forms-inventory.{md,json}");
}

main();
