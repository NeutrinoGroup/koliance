# 038: 极简硬核四幕 Demo 视频工程落地 (video-shotcraft 自主自由创作)

## 1. 变更背景与目标

依据黑客松与投资评委「前 90 秒抓人决策、录屏切忌长篇 PPT」的标准，采用 `video-shotcraft` 技能库的八阶段流水线与电影感镜头配方卡（`DigitRoll`、`BackgroundGrid`、`HudHeader`、`SubtitleOverlay` 等），基于真实 Web DApp（[`DeveloperConsole`](file:///Users/alexander/bwa/koliance/src/components/DeveloperConsole.tsx)、[`AgentCardTerminal`](file:///Users/alexander/bwa/koliance/src/components/AgentCardTerminal.tsx)、[`MarketTerminal`](file:///Users/alexander/bwa/koliance/src/components/MarketTerminal.tsx)）与 Monad 测试网链上架构，自主自由创作打造时长 150 秒（4500 帧 @ 30fps，1920x1080）的高密度硬核演示视频工程。

## 2. 四幕镜头叙事与时间轴规划

| 幕次 | 时间区间 | 帧数区间 | 核心主题 | 镜头卡与动效语法 | 叙事与演示要点 |
|---|---|---|---|---|---|
| **第 1 幕** | 0:00 - 0:30 | 0f - 900f | **痛点与破局** | `shake-critical` + `spotlight-hero-card` | 展示裸露私钥被 Prompt 注入/死循环掏空金库的灾难，引出 Koliance EIP-712 Session Key + AgentCard 双重风控装甲（单笔 $100、日限 $500、MCC 白名单、毫秒级断路器）。 |
| **第 2 幕** | 0:30 - 1:15 | 900f - 2250f | **身份与信用锚定** | `terminal-3d` + `DigitRoll` | 在前端演示 Steam / GitHub 身份关联，零知识脱敏验证，链上信用分从 0 动态跃升至 820 AAA 级，激活 $5,000 USD 无抵押信用配额与 EIP-712 会话子密钥。 |
| **第 3 幕** | 1:15 - 2:00 | 2250f - 3600f | **Agent 自主开仓与支付** | `split-compare-pan` + `impact-feedback` | 分屏演示 Agent 决策大脑与 Monad Perp 实时终端：自主开多 MON、流式支付算力微额代币；在并发异常与超限尝试时，触发限频与熔断断路器，资产 100% 毫发无损。 |
| **第 4 幕** | 2:00 - 2:30 | 3600f - 4500f | **链上存证与架构** | `page-cam-push` + `vertical-ticker` | Monad Explorer 真实交易 Hash 核验（0.42s 确认、低 Gas），合规净资产结算（GAP-06/14 对拍零坏账），点题 Monad 10,000 TPS 并行 EVM 的不可替代性。 |

## 3. 文件变更清单

- **视频工程脚手架与配置**：
  - [`video/package.json`](file:///Users/alexander/bwa/koliance/video/package.json): Remotion 4.0 渲染依赖与运行脚本。
  - [`video/remotion.config.ts`](file:///Users/alexander/bwa/koliance/video/remotion.config.ts): 本地 Chromium Headless 渲染加速配置。
  - [`video/tsconfig.json`](file:///Users/alexander/bwa/koliance/video/tsconfig.json): TypeScript 编译规则。
- **核心组件与多音轨设计**：
  - [`video/src/types.ts`](file:///Users/alexander/bwa/koliance/video/src/types.ts): 视频属性定义。
  - [`video/src/components/BackgroundGrid.tsx`](file:///Users/alexander/bwa/koliance/video/src/components/BackgroundGrid.tsx): Slate/Charcoal 暗色蓝图网格与 Monad 紫/青光晕。
  - [`video/src/components/HudHeader.tsx`](file:///Users/alexander/bwa/koliance/video/src/components/HudHeader.tsx): 顶部极简开发者 HUD 仪表盘与幕次进度追踪。
  - [`video/src/components/SubtitleOverlay.tsx`](file:///Users/alexander/bwa/koliance/video/src/components/SubtitleOverlay.tsx): 帧级双语硬核字幕层。
  - [`video/src/components/AudioLayer.tsx`](file:///Users/alexander/bwa/koliance/video/src/components/AudioLayer.tsx): BGM 电子底噪与 8 处关键命中 SFX。
  - [`video/src/workbench.ts`](file:///Users/alexander/bwa/koliance/video/src/workbench.ts): 动效工作台镜头清单与元数据声明。
- **四幕分镜头落地**：
  - [`video/src/acts/Act1_PainAndSolution.tsx`](file:///Users/alexander/bwa/koliance/video/src/acts/Act1_PainAndSolution.tsx): 第 1 幕痛点与破局。
  - [`video/src/acts/Act2_IdentityAndCredit.tsx`](file:///Users/alexander/bwa/koliance/video/src/acts/Act2_IdentityAndCredit.tsx): 第 2 幕身份与信用锚定。
  - [`video/src/acts/Act3_AgentAutonomousTrading.tsx`](file:///Users/alexander/bwa/koliance/video/src/acts/Act3_AgentAutonomousTrading.tsx): 第 3 幕自主交易与熔断。
  - [`video/src/acts/Act4_OnChainSettlement.tsx`](file:///Users/alexander/bwa/koliance/video/src/acts/Act4_OnChainSettlement.tsx): 第 4 幕链上存证与 Monad 并行优势。
  - [`video/src/MainVideo.tsx`](file:///Users/alexander/bwa/koliance/video/src/MainVideo.tsx): 全片总谱编排。
  - [`video/src/Root.tsx`](file:///Users/alexander/bwa/koliance/video/src/Root.tsx) / [`video/src/index.ts`](file:///Users/alexander/bwa/koliance/video/src/index.ts): Remotion 注册入口。

## 4. 验证日志与静帧抽检结果

```bash
# 验证命令：批量输出四幕 7 个关键自检静帧
cd video && npx remotion still src/index.ts KolianceDemo out/qa/frame-200.png --frame=200 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-600.png --frame=600 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-1100.png --frame=1100 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-1800.png --frame=1800 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-2500.png --frame=2500 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-3200.png --frame=3200 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-3800.png --frame=3800 \
  && npx remotion still src/index.ts KolianceDemo out/qa/frame-4300.png --frame=4300
```

- **frame-200.png**: [PASS] 痛点终端警报与资金归零警示，红黑对比鲜明。
- **frame-600.png**: [PASS] Koliance 协议四根安全支柱落位有力，hold 呼吸感充足。
- **frame-1100.png**: [PASS] GitHub / Steam 双墙验证排版平整，零胶囊圆角，纯正微倒角 SaaS 质感。
- **frame-1800.png**: [PASS] `DigitRoll` 820 分与 $5,000 配额准确落定。
- **frame-2500.png**: [PASS] 分屏显示 Agent 决策与实时订单回报，小额扣费流平稳。
- **frame-3200.png**: [PASS] 超限与高频并发拦截网激活，Session Key 实时冻结，本金保护达成。
- **frame-3800.png**: [PASS] Monad Explorer 真实交易 Hash 细节清晰，亚秒级确认点题。
- **frame-4300.png**: [PASS] 10,000 TPS 并行架构与品牌定妆完备。

## 5. 审美准则自检 (aesthetic-rules.md)

- `R1 [PASS]`: 关键品牌字标与结算数据落定后静止 ≥ 1.5s（> 45 帧），呼吸感充足。
- `R2 [PASS]`: 动效均采用 Spring/Bezier 非线性缓动，避免匀速幻灯片质感。
- `R3 [PASS]`: 节奏沉稳，4 幕总时长 150 秒，平均每幕 30~45 秒，评委可从容阅读。
- `R4 [PASS]`: 全片无全屏高频震动闪烁，仅在关键攻击/拦截节点触发局部聚焦震颤。
- `Q1 [PASS]`: 严格复用 Web DApp 既有真实组件与设计语言（`rounded-md`/`rounded-lg`，深色高对比度，零黄色）。
- `S1-S3 [PASS]`: BGM 采用低音科技电子底噪，SFX 与关键撞击同帧触发。
- `C1-C3 [PASS]`: 零空泛口号，全部采用硬核技术术语（EIP-712、MCC 白名单、防穿仓断路器、并行 EVM）。
