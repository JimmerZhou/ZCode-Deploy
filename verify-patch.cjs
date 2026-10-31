// ============================================
// ZCode 补丁功能验证器
// 用法: node verify-patch.cjs [zcode.cjs 路径]
// 作用: 真正执行补丁后的函数，确认 system 层已被替换
//       而不只是"字符串对上了"
// ============================================
const fs = require('fs');
const path = require('path');

function resolveTarget() {
    if (process.argv[2]) { return process.argv[2]; }
    if (process.env.ZCODE_DIR) { return path.join(process.env.ZCODE_DIR, 'resources', 'glm', 'zcode.cjs'); }
    try {
        const cache = fs.readFileSync(path.join(__dirname, 'zcode-dir.txt'), 'utf8').trim();
        if (cache) { return path.join(cache, 'resources', 'glm', 'zcode.cjs'); }
    } catch (e) { /* 无缓存则回退默认 */ }
    return 'D:\\app\\zcode\\resources\\glm\\zcode.cjs';
}
const target = resolveTarget();
const personaFile = path.join(__dirname, '人格.txt');

let fail = 0;
function check(label, ok, extra) {
    console.log((ok ? '  [OK]   ' : '  [FAIL] ') + label + (extra ? '   -> ' + extra : ''));
    if (!ok) { fail++; }
}

if (!fs.existsSync(target)) { console.log('目标文件不存在: ' + target); process.exit(1); }
const src = fs.readFileSync(target, 'utf8');
const persona = fs.readFileSync(personaFile, 'utf8');

console.log('目标: ' + target);
console.log('大小: ' + src.length + ' chars');
console.log('');

// ---- 1. 部署标记 ----
const markerCount = src.split('ZP:PERSONA').length - 1;
check('注入标记 ZP:PERSONA 存在 (期望 2 处)', markerCount === 2, markerCount + ' 处');
if (markerCount === 0) {
    console.log('');
    console.log('结果: 未部署，后续检查跳过');
    process.exit(1);
}

// ---- 2. 静态检查 ----
check('CLI Prefix 身份声明已清空', !/="You are ZCode, an interactive [^"]*"/.test(src));
check('customSystemPrompt 原逻辑已被替换', !src.includes('this.config.customSystemPrompt'));

// ---- 3. 实际执行注入的读取表达式 ----
let readerOk = 0, readerTotal = 0, sample = null;
let pos = 0;
while (true) {
    const start = src.indexOf('(function(){/*ZP:PERSONA*/', pos);
    if (start < 0) { break; }
    const end = src.indexOf('})()', start);
    if (end < 0) { break; }
    readerTotal++;
    const exprSrc = src.slice(start, end + 4);
    try {
        const val = new Function('require', 'return (' + exprSrc + ');')(require);
        if (val && val === persona) { readerOk++; }
        if (sample === null) { sample = val; }
    } catch (e) {
        console.log('  执行失败: ' + e.message);
    }
    pos = end + 4;
}
check('注入的读取表达式能读到人格文件 (' + readerOk + '/' + readerTotal + ')',
      readerTotal === 2 && readerOk === 2,
      sample ? sample.length + ' chars' : 'null');

// ---- 4. 花括号配平定位：真正包住锚点的那个函数 ----
function extractFn(name) {
    const start = src.indexOf('function ' + name + '(');
    if (start < 0) { return null; }
    const open = src.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') { depth++; }
        else if (ch === '}') { depth--; if (depth === 0) { return src.slice(start, i + 1); } }
    }
    return null;
}

function braceClose(open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') { depth++; }
        else if (ch === '}') { depth--; if (depth === 0) { return i; } }
    }
    return -1;
}

function findFnForLiteral(literal) {
    const idx = src.indexOf(literal);
    if (idx < 0) { return null; }
    const start = Math.max(0, idx - 2000);
    const head = src.slice(start, idx);
    const re = /function\s+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/g;
    let best = null, m;
    while ((m = re.exec(head)) !== null) {
        const open = start + m.index + m[0].length - 1;
        if (braceClose(open) > idx) { best = m[1]; }
    }
    return best;
}

// 从函数体里提取 `let X=<单个标识符>;` 引用的模块级变量名。
// 新版 bundle 把身份文案挪到了模块级变量 (如 uBa)，剥离执行时需要覆盖它。
function letRefs(body) {
    const out = [];
    const re = /(?:let|const|var)\s+[A-Za-z_$][\w$]*\s*=\s*([A-Za-z_$][\w$]*)\s*;/g;
    let m;
    while ((m = re.exec(body)) !== null) { out.push(m[1]); }
    return out;
}

// 剥离执行的兜底作用域: 未在 overrides 里的标识符 (ef/fBa 等压缩helper) 一律替换为空函数，
// overrides 里的名字用真品/指定值 (如 require、置空的 uBa)。
function runShimmed(body, callExpr, overrides) {
    const ov = Object.assign({ require: require }, overrides || {});
    const shim = new Proxy(ov, {
        has() { return true; },
        get(t, k) {
            if (k === Symbol.unscopables) { return undefined; }
            return (k in t) ? t[k] : () => 0;
        }
    });
    return new Function('__zs', 'with(__zs){' + body + '\nreturn ' + callExpr + ';}')(shim);
}

const sections = [
    ['日期提醒',              'name:"Current Date",source:"current_date"'],
    ['Skills 列表',           'name:"Skills",source:"skills"'],
    ['User Context',          'name:"Request User Context",source:"request_user_context"'],
];

for (const item of sections) {
    const actual = findFnForLiteral(item[1]);
    const body = actual ? extractFn(actual) : null;
    if (!body) { check(item[0] + ' 函数可定位', false, '未找到包住锚点的函数'); continue; }
    if (body.indexOf('{return null;') < 0) {
        check(item[0] + ' 已置空 (' + actual + ')', false, '函数体开头不是 return null;');
        continue;
    }
    try {
        const fn = new Function('wm', 'return (' + body + ');')(() => 0);
        check(item[0] + ' 已置空并实际返回 null (' + actual + ')', fn({ outcome: { skills: [] } }) === null);
    } catch (e) {
        check(item[0] + ' 已置空 (' + actual + ')', false, '执行异常: ' + e.message);
    }
}

// ---- 5. CLI Prefix 实际返回空串 ----
const jmeName = findFnForLiteral('name:"CLI Prefix",source:"cli_prefix"');
const jmeBody = jmeName ? extractFn(jmeName) : null;
if (jmeBody) {
    try {
        const overrides = {};
        for (const ref of letRefs(jmeBody)) { overrides[ref] = ''; }
        const section = runShimmed(jmeBody, jmeName + '();', overrides);
        check('CLI Prefix 片段内容为空 (' + jmeName + ')', section && section.content === '');
    } catch (e) {
        check('CLI Prefix 片段内容为空', false, e.message);
    }
} else {
    check('CLI Prefix 函数可定位', false);
}

// ---- 6. Agent Identity 实际读到人格 ----
const idName = findFnForLiteral('name:"Agent Identity",source:"identity"');
const idBody = idName ? extractFn(idName) : null;
if (idBody) {
    try {
        const section = runShimmed(idBody, idName + '({});');
        check('Agent Identity 读到人格文件 (' + idName + ')', section && section.content === persona,
              section ? section.content.length + ' chars' : 'null');
    } catch (e) {
        check('Agent Identity 读到人格文件', false, e.message);
    }
} else {
    check('Agent Identity 函数可定位', false);
}

console.log('');
if (fail === 0) {
    console.log('结果: 全部通过 —— system 层已是人格文件，产品注入已清除');
    process.exit(0);
} else {
    console.log('结果: ' + fail + ' 项失败 —— 补丁未完全生效');
    process.exit(1);
}
