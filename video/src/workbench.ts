import { createElement, type FC } from 'react';
import { Act1_PainAndSolution } from './acts/Act1_PainAndSolution';
import { Act2_IdentityAndCredit } from './acts/Act2_IdentityAndCredit';
import { Act3_AgentAutonomousTrading } from './acts/Act3_AgentAutonomousTrading';
import { Act4_OnChainSettlement } from './acts/Act4_OnChainSettlement';

export const SHOTS = [
  { id: 'act1_pain_and_solution', title: 'Act 1: 痛点与破局', from: 0, duration: 900, component: Act1_PainAndSolution },
  { id: 'act2_identity_and_credit', title: 'Act 2: 身份与信用锚定', from: 900, duration: 1350, component: Act2_IdentityAndCredit },
  { id: 'act3_agent_trading', title: 'Act 3: Agent 自主交易与支付', from: 2250, duration: 1350, component: Act3_AgentAutonomousTrading },
  { id: 'act4_settlement', title: 'Act 4: 链上存证与架构', from: 3600, duration: 900, component: Act4_OnChainSettlement },
];

export const WORKBENCH = {
  meta: {
    id: 'KolianceDemo',
    title: 'Koliance AI Agent Asset Protocol Demo Video',
    durationInFrames: 4500,
    fps: 30,
    width: 1920,
    height: 1080,
  },
  shots: SHOTS,
};
