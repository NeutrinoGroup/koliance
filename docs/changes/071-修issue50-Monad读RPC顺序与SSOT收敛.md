# 071 — 修 issue #50：Monad 读 RPC 顺序（drpc 端点不支持 `eth_call`，却被放在 fallback 首位）

> **环**：02 开发（前端 `src/` + 测试）
> **来源**：issue **#50** —— 真浏览器直连线上站点 + 直连 RPC 端点实测发现。
> **先写后填**：本文在改动前立；§3、§4 落地后回灌真实 stdout。
> **基线**：`upstream/main` @ `1691e43`；分支 `fix/issue50-rpc-fallback-order`。

---

## 1. 缺陷事实（实测，非推断）

线上 `/token` 页产生 **3 个到 `monad-testnet.drpc.org` 的 HTTP 400**。直连该端点逐方法 POST：

| 方法 | 结果 |
| --- | --- |
| `eth_chainId` | **200** ✅ |
| `eth_blockNumber` | **400** `the method eth_blockNumber does not exist/is not available` |
| `eth_call` | **400** `the method eth_call does not exist/is not available` |

而 `https://testnet-rpc.monad.xyz` 的 `eth_call` 返回 **200** 正常结果。

⇒ 该端点**不适合作为合约读取的 RPC**，而三处以 `fallback([drpc, testnet-rpc])` 把它排在了**首位**。

## 2. 根因：不是「排序写错」，是**同一份端点表被抄了三遍**

`src/lib/contract.ts` 的 `rpcUrls` **本来就是对的**（`testnet-rpc` 在前）。缺陷来自三处组件
**各自内联了一份 fallback 列表**，顺序与 SSOT **相反**：

| 文件 | 位置（改前） | 影响 |
| --- | --- | --- |
| `src/components/NavAuthBadges.tsx` | `:183-186` | 导航栏 KOL 余额 |
| `src/components/TransferModal.tsx` | `:68-71` | 转账弹窗余额读取 |
| `src/components/TokenStudio.tsx` | `:83-86` | `/token` 总供应量 / era / rate |

**同一份事实存在两处不同成熟度的副本**（D4）——而且是「对的那份没人用、错的那份抄了三遍」。
**这正是它不会被任何测试发现的理由**：没有一条判据约束「端点表只有一个来源」。

## 3. 修法（SSOT + 收敛调用点）

**`src/lib/contract.ts`**：把端点表提为**唯一事实源**，并提供构造函数。

```ts
export const MONAD_RPC_URLS = [
  "https://testnet-rpc.monad.xyz",   // eth_call 可用 —— 必须在前
  "https://monad-testnet.drpc.org",  // 备位（仅 eth_chainId 等少量方法）
] as const;

export function monadRpcTransport() {
  return fallback(MONAD_RPC_URLS.map((url) => http(url)));
}
```

`rpcUrls.default/public.http` 改为 `[...MONAD_RPC_URLS]` —— 于是**链定义与传输层同源**。

**三处组件**：删掉内联 `fallback([...])`，改调 `monadRpcTransport()`；随即 `http` / `fallback` 变为未使用，从 `viem` 导入中移除。

> **为何返回构造函数而不是共享常量**：`createPublicClient` 会被调用多次，返回新实例可避免「跨 client 共享 transport 状态」这类需要理由的东西——**没有共享状态，就没有要解释的共享状态**。

**为什么选 SSOT 而不是就地两行互换**：就地互换只修好今天这三处，抄第四遍照样漂移。
本次把**漂移的成因**（重复声明）一并去掉，并由 §4 的判据守住。

## 4. 判据（`tests/monad-rpc-order.test.ts`，新增 2 条）

| 用例 | 断言 |
| --- | --- |
| `lists testnet-rpc.monad.xyz first …` | `MONAD_RPC_URLS[0]` 必须是 `testnet-rpc.monad.xyz`；drpc 仍在表中且 `indexOf > 0`（是备位，不是被删） |
| `defines the Monad RPC endpoint set in exactly one place` | 遍历 `src/**/*.{ts,tsx}`，**含 drpc 主机名的文件必须只有 `src/lib/contract.ts`**；否则点名违规文件 |

### 4.1 实测（真实 stdout）

```
$ npx vitest run tests/monad-rpc-order.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

### 4.2 负向证伪（D3，两条都真跑）

**变异 1 —— 把 SSOT 顺序翻回去**：
```
AssertionError: expected 'https://monad-testnet.drpc.org' to be 'https://testnet-rpc.monad.xyz'
  ❯ tests/monad-rpc-order.test.ts:36:31
 Tests  1 failed (2)
```

**变异 2 —— 在组件里重新内联一份端点**（模拟本缺陷的成因）：
```
AssertionError: Monad RPC endpoint list duplicated outside the SSOT —
  call monadRpcTransport() from src/lib/contract.ts instead:
  src\components\TokenStudio.tsx
  ❯ tests/monad-rpc-order.test.ts:55:7
 Tests  1 failed (2)
```

**两条变异各自只让对应用例变红**，还原后 2 条全绿。**第二条尤其关键**：它守的不是「这次改对了」，
而是「**这份表不会再次被抄走**」——即缺陷的**成因**，而非缺陷的**当前形态**。

## 5. 全量回归（本机实测）

```
$ npx tsc --noEmit                       exit=0
$ npx vitest run
 Test Files  27 passed (27)
      Tests  327 passed (327)            # 325 → 327（+2 条新判据）
```

`git grep -n "monad-testnet.drpc.org" -- src/` 现在只命中 `src/lib/contract.ts`（SSOT 一处 + 注释一处）。

## 6. 残余边界（如实写明）

| 项 | 边界 |
| --- | --- |
| **判据覆盖面** | 判据守的是「端点表只有一处 + 顺序正确」。它**不验证** drpc 端点在**未来**是否恢复 `eth_call`——若哪天恢复，顺序仍应为 `testnet-rpc` 在前（无理由改）。 |
| **未做的第三选项** | issue #50 提过「直接删掉 drpc」。本轮**保留它作备位**——删掉是更激进的口径（它仍是有效的 `eth_chainId` 源），且删除主网端点属运维取舍，**不在本次作用域**。 |
| **其他 RPC 端点** | `src/lib/perpChain.ts:34` · `src/lib/wagmi.ts:13,25` 各自单列 `testnet-rpc.monad.xyz`（**顺序本就正确**）。本次**未合并**它们到 SSOT——它们用的是**单个** URL 而非 fallback 列表，语义不同，合并属重构而非修缺陷。**登记为可选后续**。 |
| **`Promise.all` 与 `fallback` 的交互** | 三个读合约的组件都用 `Promise.all` 并发发 `eth_call`；`fallback` 的失败重试是**每次调用**独立进行的。本修法消除了**必然失败的那一次**，但并未改变「端点真挂掉时每个并发请求各自重试」的既有行为——那是另一个议题，**本次不动**。 |
