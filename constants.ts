export interface ChartConfig {
    title: string;
    description?: string;
    metrics: string[];
    colors?: string[];
  }
  
  export const CHART_GROUPS: ChartConfig[] = [
    {
      title: "1. Clustering Metrics",
      description: "Core performance indicators (0-1 range). Look for rising ACC/NMI/ARI.",
      metrics: ["ACC", "NMI", "ARI", "F1", "PUR"],
      colors: ["#2563eb", "#9333ea", "#db2777", "#dc2626", "#ea580c"]
    },
    {
      title: "2.1 Optimization: Learning Rate",
      description: "Learning rate schedule (usually small magnitude).",
      metrics: ["lr"],
      colors: ["#059669"]
    },
    {
      title: "2.2 Optimization: Parameters",
      description: "Gate ramping (0->1) and temperatures.",
      metrics: ["gate", "temp_f", "temp_l"],
      colors: ["#d97706", "#7c3aed", "#4f46e5"]
    },
    {
      title: "3.1 Loss Decomposition (Main)",
      description: "Dominant loss terms (Higher Magnitude).",
      metrics: ["L_total", "L_feat", "L_cross"],
      colors: ["#1e293b", "#3b82f6", "#ef4444"]
    },
    {
      title: "3.2 Loss Decomposition (Auxiliary)",
      description: "Regularization and auxiliary terms (Lower Magnitude).",
      metrics: ["L_cluster", "L_recon", "L_uncert", "L_hn", "L_reg"],
      colors: ["#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#6366f1"]
    },
    {
      title: "4.1 Routing: Scale (Total Counts)",
      description: "Large volume metrics (thousands).",
      metrics: ["neg_count", "safe_neg_count", "candidate_neg_size", "neg_after_filter_size", "neg_used_in_loss_size"],
      colors: ["#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"]
    },
    {
      title: "4.2 Routing: Scale (Per Anchor/Batch)",
      description: "Smaller count metrics (tens to hundreds).",
      metrics: ["neg_per_anchor", "U_size"],
      colors: ["#dc2626", "#0ea5e9"]
    },
    {
      title: "4.3 Routing: Ratios (Major)",
      description: "Dominant ratios (close to 1.0).",
      metrics: ["safe_ratio", "denom_safe_share"],
      colors: ["#22c55e", "#15803d"]
    },
    {
      title: "4.4 Routing: Ratios (Minor/Rare)",
      description: "Small ratios and parameters (close to 0.0-0.2).",
      metrics: ["FN_ratio", "HN_ratio", "alpha_fn", "hn_beta", "denom_fn_share"],
      colors: ["#ef4444", "#f97316", "#94a3b8", "#cbd5e1", "#b91c1c"]
    },
    {
      title: "4.5 Routing: Discriminative (Stats)",
      description: "Similarity and posterior values (0-1).",
      metrics: ["mean_sim_HN", "mean_sim_safe_nonHN", "sim_neg_p99", "mean_s_post_FN", "mean_s_post_nonFN"],
      colors: ["#8b5cf6", "#a78bfa", "#1e293b", "#ec4899", "#f472b6"]
    },
    {
      title: "4.6 Routing: Discriminative (Deltas)",
      description: "Differences between groups (Small Positive).",
      metrics: ["delta_post", "delta_sim"],
      colors: ["#be185d", "#7c3aed"]
    },
    {
      title: "4.7 Stability (Cluster Counts)",
      description: "Cluster statistics (Integers).",
      metrics: ["min_cluster", "empty_cluster", "route_count_inconsistent"],
      colors: ["#6366f1", "#ef4444", "#dc2626"]
    },
    {
      title: "4.8 Stability (Consistency Rates)",
      description: "Stability metrics and correlations (0-1 or -1 to 1).",
      metrics: ["label_flip", "stab_rate", "assignment_stability", "corr_u_fn"],
      colors: ["#f59e0b", "#10b981", "#059669", "#d97706"]
    },
    {
      title: "4.9 Weights (0-1)",
      description: "Weight statistics.",
      metrics: ["w_mean_on_FN", "w_mean_on_safe", "w_hit_min_ratio"],
      colors: ["#ef4444", "#22c55e", "#64748b"]
    },
    {
        title: "4.10 Distributions",
        description: "Uncertainty and Gamma stats.",
        metrics: ["u_mean", "u_p50", "gamma_mean"],
        colors: ["#f97316", "#fbbf24", "#8b5cf6"]
    }
  ];