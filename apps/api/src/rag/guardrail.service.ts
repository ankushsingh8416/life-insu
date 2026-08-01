import { Injectable } from "@nestjs/common";
import { GuardrailResult } from "@sabsepehle/shared-types";

const IN_DOMAIN_KEYWORDS = [
  "insurance",
  "life insurance",
  "health insurance",
  "policy",
  "policies",
  "premium",
  "claim",
  "irdai",
  "rider",
  "sum assured",
  "nominee",
  "maturity",
  "surrender",
  "mediclaim",
  "cashless",
  "hospitalisation",
  "hospitalization",
  "tax benefit",
  "80c",
  "80d",
  "pension",
  "annuity",
  "term plan",
  "endowment",
  "ulip",
  "underwriting",
  "grace period",
  "sabse pehle",
  "sabsepehle",
  "बीमा",
  "पॉलिसी",
  "प्रीमियम",
  "दावा",
];

// Questions about the assistant/company's own identity — answerable directly from
// the system prompt's identity block, so they must NOT be blocked by the
// "no supporting context found" guard the way a factual insurance claim would be.
const META_KEYWORDS = [
  "who are you",
  "what are you",
  "what is sabse pehle",
  "what is sabsepehle",
  "about sabse pehle",
  "about sabsepehle",
  "what can you help",
  "what can you do",
  "what do you do",
  "how can you help",
  "your name",
  "about you",
  "tell me about yourself",
  "what languages do you support",
  "what languages do you speak",
  "which languages do you speak",
  "sabsepehlelifeinsurance",
];

const OUT_OF_DOMAIN_KEYWORDS = [
  "write code",
  "python script",
  "javascript function",
  "leetcode",
  "who will win the election",
  "prime minister",
  "movie review",
  "cricket score",
  "football match",
  "recipe for",
  "how to cook",
  "solve this equation",
  "homework",
  "tell me a joke",
  "write a poem about",
  "song lyrics",
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|any|previous|the) (instructions|prompt)/i,
  /disregard (all|any|previous) (instructions|rules)/i,
  /you are now (a|an) /i,
  /reveal (your|the) (system prompt|instructions)/i,
  /act as (if you were|a) (dan|jailbreak)/i,
  /pretend (you have no|there are no) (restrictions|rules)/i,
];

const PII_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "aadhaar", pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: "pan", pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  { name: "card", pattern: /\b(?:\d[ -]*?){13,16}\b/ },
  { name: "email", pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/ },
];

const RECENCY_PATTERN = /\b(latest|recent|newest|new)\b/i;
const CONTENT_PATTERN = /\b(blog|post|article|update|news)\b/i;

/** "what's your latest blog post" etc — a class of query embeddings fundamentally
 * can't answer (there's no "recency" dimension in a similarity score), so it needs
 * routing to metadata (updatedAt) or a live fetch instead of vector retrieval. */
export function isRecencyContentQuery(query: string): boolean {
  return RECENCY_PATTERN.test(query) && CONTENT_PATTERN.test(query);
}

@Injectable()
export class GuardrailService {
  /** Fast, pre-retrieval classification. Retrieval-score-based confirmation happens in RagService. */
  classifyIntent(query: string): GuardrailResult {
    const normalized = query.toLowerCase();

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(query)) {
        return { allowed: false, matchedCategory: "prompt_injection", reason: "prompt_injection_detected" };
      }
    }

    // Checked before IN_DOMAIN_KEYWORDS: a meta question like "what is Sabse Pehle"
    // would otherwise match the generic "sabsepehle" keyword and get routed through
    // the strict retrieval-required path, which incorrectly rejects it when the
    // knowledge base has no matching chunks — even though the answer (who the
    // assistant is) doesn't require retrieval at all.
    if (META_KEYWORDS.some((kw) => normalized.includes(kw))) {
      return { allowed: true, matchedCategory: "meta" };
    }

    if (IN_DOMAIN_KEYWORDS.some((kw) => normalized.includes(kw))) {
      return { allowed: true, matchedCategory: "in_domain" };
    }

    if (OUT_OF_DOMAIN_KEYWORDS.some((kw) => normalized.includes(kw))) {
      return { allowed: false, matchedCategory: "out_of_domain", reason: "keyword_denylist" };
    }

    // Ambiguous — defer to retrieval-score confirmation (RagService checks topScore).
    return { allowed: true, matchedCategory: "in_domain", reason: "deferred_to_retrieval" };
  }

  /** Redacts obvious PII before content is written to logs/analytics (not to the chat transcript itself). */
  redactPii(text: string): string {
    let redacted = text;
    for (const { pattern } of PII_PATTERNS) {
      redacted = redacted.replace(pattern, "[REDACTED]");
    }
    return redacted;
  }

  containsPii(text: string): boolean {
    return PII_PATTERNS.some(({ pattern }) => pattern.test(text));
  }
}
