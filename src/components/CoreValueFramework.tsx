"use client";

import React from "react";
import { AgentThesisReactor } from "@/components/AgentThesisReactor";
import { ArchitectureTopologyMatrix } from "@/components/ArchitectureTopologyMatrix";

export function CoreValueFramework() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 space-y-24">
      {/* 1. Problem Definition & Thesis Interactive Console + Dynamic Pipeline Bus */}
      <AgentThesisReactor />

      {/* 2. Strategic Functional Architecture Topology Matrix */}
      <ArchitectureTopologyMatrix />
    </div>
  );
}
