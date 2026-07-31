/**
 * Template engine matching ProjZero's FUITemplateEngine semantics.
 *
 * Syntax:
 *   $key$              — scalar token replacement
 *   $item.field$       — loop item field access
 *   //$for item in list$  ...  //$endfor$   — loop block
 *   //$if expr$        ...  //$endif$        — conditional block (truthy: non-empty, not "false"/"0")
 *
 * Strict mode: unresolved tokens throw Error.
 */
export interface TemplateContext {
    /** Scalar values (key → string). */
    scalars: Record<string, string>;
    /** Loop data (name → rows). */
    loops: Record<string, Record<string, string>[]>;
}

// ── regex ──────────────────────────────────────────────────────────
const TOKEN_RX = /\$(?<key>[A-Za-z0-9_\\.]+)\$/g;
const FOR_START_RX = /^\/\/\$for\s+(?<item>[A-Za-z_]\w*)\s+in\s+(?<list>[A-Za-z_]\w*)\$$/;
const IF_START_RX = /^\/\/\$if\s+(?<expr>[A-Za-z0-9_\\.!]+)\$$/;

// ── AST nodes ──────────────────────────────────────────────────────
type Node = TextNode | ForNode | IfNode;

interface TextNode { kind: 'text'; text: string; lineNo: number; }
interface ForNode { kind: 'for'; itemName: string; loopName: string; children: Node[]; lineNo: number; }
interface IfNode { kind: 'if'; expression: string; children: Node[]; lineNo: number; }

// ── public API ─────────────────────────────────────────────────────

export function renderTemplate(template: string, ctx: TemplateContext, strict = true): string {
    const lines = template.replace(/\r\n/g, '\n').split('\n');
    const root = parse(lines);
    const locals: Record<string, Record<string, string>> = {};
    const out: string[] = [];
    renderNodes(root, ctx, locals, out, strict);
    return out.join('');
}

// ── parser ─────────────────────────────────────────────────────────

function parse(lines: string[]): Node[] {
    const root: Node[] = [];
    const stack: { node: ForNode | IfNode }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const lineNo = i + 1;

        const forMatch = FOR_START_RX.exec(trimmed);
        if (forMatch) {
            const node: ForNode = {
                kind: 'for',
                itemName: forMatch.groups!.item,
                loopName: forMatch.groups!.list,
                children: [],
                lineNo,
            };
            pushNode(stack, root, node);
            stack.push({ node });
            continue;
        }

        if (trimmed === '//$endfor$') {
            if (stack.length === 0 || stack[stack.length - 1].node.kind !== 'for') {
                throw new Error(`Template parse error at line ${lineNo}: unexpected //$endfor$`);
            }
            stack.pop();
            continue;
        }

        const ifMatch = IF_START_RX.exec(trimmed);
        if (ifMatch) {
            const node: IfNode = {
                kind: 'if',
                expression: ifMatch.groups!.expr,
                children: [],
                lineNo,
            };
            pushNode(stack, root, node);
            stack.push({ node });
            continue;
        }

        if (trimmed === '//$endif$') {
            if (stack.length === 0 || stack[stack.length - 1].node.kind !== 'if') {
                throw new Error(`Template parse error at line ${lineNo}: unexpected //$endif$`);
            }
            stack.pop();
            continue;
        }

        pushNode(stack, root, { kind: 'text', text: lines[i] + '\n', lineNo });
    }

    if (stack.length > 0) {
        const top = stack[stack.length - 1].node;
        const directive = top.kind === 'for' ? '//$for' : '//$if';
        throw new Error(`Template parse error: missing terminator for ${directive} at line ${top.lineNo}`);
    }

    return root;
}

function pushNode(stack: { node: ForNode | IfNode }[], root: Node[], node: Node): void {
    if (stack.length === 0) { root.push(node); return; }
    stack[stack.length - 1].node.children.push(node);
}

// ── renderer ───────────────────────────────────────────────────────

function renderNodes(
    nodes: Node[],
    ctx: TemplateContext,
    locals: Record<string, Record<string, string>>,
    out: string[],
    strict: boolean,
): void {
    for (const node of nodes) {
        if (node.kind === 'text') {
            out.push(resolveTokens(node.text, ctx, locals, strict));
        } else if (node.kind === 'for') {
            const rows = ctx.loops[node.loopName];
            if (!rows) {
                if (strict) throw new Error(`Template render error at line ${node.lineNo}: loop "${node.loopName}" not provided`);
                continue;
            }
            for (const row of rows) {
                locals[node.itemName] = row;
                renderNodes(node.children, ctx, locals, out, strict);
            }
            delete locals[node.itemName];
        } else if (node.kind === 'if') {
            if (evalExpr(node.expression, ctx, locals)) {
                renderNodes(node.children, ctx, locals, out, strict);
            }
        }
    }
}

function resolveTokens(
    text: string,
    ctx: TemplateContext,
    locals: Record<string, Record<string, string>>,
    strict: boolean,
): string {
    TOKEN_RX.lastIndex = 0;
    return text.replace(TOKEN_RX, (match, key: string) => {
        // $item.field$ — loop scope
        const dot = key.indexOf('.');
        if (dot > 0) {
            const localName = key.slice(0, dot);
            const fieldName = key.slice(dot + 1);
            const row = locals[localName];
            if (row && fieldName in row) return row[fieldName];
        }
        // $key$ — scalar
        if (key in ctx.scalars) return ctx.scalars[key];
        if (strict) throw new Error(`Template render error: unresolved token "$${key}$"`);
        return match;
    });
}

function evalExpr(expr: string, ctx: TemplateContext, locals: Record<string, Record<string, string>>): boolean {
    const inverted = expr.startsWith('!');
    const token = inverted ? expr.slice(1) : expr;

    let value: string | undefined;
    const dot = token.indexOf('.');
    if (dot > 0) {
        const localName = token.slice(0, dot);
        const fieldName = token.slice(dot + 1);
        value = locals[localName]?.[fieldName];
    } else {
        value = ctx.scalars[token];
    }

    const result = value != null && value !== '' && value !== 'false' && value !== '0';
    return inverted ? !result : result;
}
