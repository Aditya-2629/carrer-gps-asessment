/**
 * interviewDefenseGenerator.js
 * In-engine dynamic interview script and resume sentence generator.
 * Zero API calls, zero latency, 100% deterministic & tailored.
 */

export function getTalkingScript(skill, targetRole = 'Professional', company = 'my organization') {
  const comp = company || 'my organization'
  const low = String(skill || '').toLowerCase()

  if (/snowflake|bigquery|dbt|redshift|spark|databricks|hadoop|airflow|sql|postgres/i.test(low)) {
    return `At ${comp}, I implemented ${skill} to engineer scalable data transformation pipelines and maintain automated schema validation, reducing reporting turnaround.`
  }
  if (/power\s*bi|tableau|looker|excel|metabase|dax|power\s*query/i.test(low)) {
    return `At ${comp}, I developed executive dashboards using ${skill} with row-level security to provide leadership with actionable visibility into core operational KPIs.`
  }
  if (/python|r\b|pandas|numpy|scipy|matplotlib|seaborn/i.test(low)) {
    return `At ${comp}, I utilized ${skill} for exploratory data analysis, automating data cleaning workflows and validating statistical significance for executive decisions.`
  }
  if (/aws|azure|gcp|docker|kubernetes|terraform|ci\/cd|git/i.test(low)) {
    return `At ${comp}, I utilized ${skill} for cloud infrastructure deployment and automated version control workflows, sustaining high delivery reliability.`
  }
  return `At ${comp}, I integrated ${skill} into our operational workflows, evaluating technical trade-offs to deliver measurable efficiency gains.`
}

export function getResumeSentence(skill, company = 'my organization') {
  const low = String(skill || '').toLowerCase()
  if (/snowflake|bigquery|dbt|redshift|spark|databricks|hadoop|airflow|sql|postgres/i.test(low)) {
    return `Engineered data pipeline transformations and automated validation schemas using ${skill}, cutting data delivery latency.`
  }
  if (/power\s*bi|tableau|looker|excel|metabase|dax|power\s*query/i.test(low)) {
    return `Designed and deployed executive dashboards in ${skill} with dynamic filters, streamlining cross-functional reporting across departments.`
  }
  if (/python|r\b|pandas|numpy|scipy|matplotlib|seaborn/i.test(low)) {
    return `Automated exploratory analysis and ETL workflows using ${skill}, ensuring data integrity for operational reporting.`
  }
  if (/aws|azure|gcp|docker|kubernetes|terraform|ci\/cd|git/i.test(low)) {
    return `Standardized cloud deployment environments and automated versioning pipelines utilizing ${skill}.`
  }
  return `Applied ${skill} to automate reporting reconciliation and support cross-functional decision workflows.`
}

export function getInterviewerQuestion(skill, company = 'your company') {
  const comp = company || 'your company'
  const low = String(skill || '').toLowerCase()
  if (/snowflake|bigquery|redshift/i.test(low)) {
    return `How did you structure your ${skill} warehouse and optimize clustering and compute costs at ${comp}?`
  }
  if (/dbt/i.test(low)) {
    return `How did you organize DAG dependencies, testing assertions, and incremental models in ${skill} at ${comp}?`
  }
  if (/power\s*bi|tableau|looker/i.test(low)) {
    return `How did you manage high-concurrency dashboard performance, data model star-schemas, and RLS using ${skill} at ${comp}?`
  }
  if (/python|pandas/i.test(low)) {
    return `How did you optimize memory usage and performance when processing large data frames with ${skill} at ${comp}?`
  }
  if (/airflow|spark/i.test(low)) {
    return `How did you ensure idempotent pipeline execution and handle backfilling in ${skill} at ${comp}?`
  }
  return `How did you apply ${skill} in production workflows at ${comp}, and what technical challenges did you resolve?`
}

export function getTradeOffJustification(skill) {
  const low = String(skill || '').toLowerCase()
  if (/snowflake|bigquery/i.test(low)) {
    return `Decoupled storage and compute to scale automated heavy ETL workloads independently without starving concurrent BI queries.`
  }
  if (/dbt/i.test(low)) {
    return `Adopted dbt over legacy stored procedures to enforce version control, automated schema assertions, and modular DAG maintainability.`
  }
  if (/power\s*bi|tableau/i.test(low)) {
    return `Built semantic models with centralized DAX measures and incremental refresh rather than fragmented ad-hoc spreadsheet reports.`
  }
  if (/python|pandas/i.test(low)) {
    return `Used vectorized operations and chunked streaming over iterative loops to sustain sub-minute ingestion throughput on memory-constrained servers.`
  }
  if (/airflow|spark/i.test(low)) {
    return `Used distributed execution and DAG dependency trees to eliminate brittle cron scripts and ensure fault-tolerant recovery on failure.`
  }
  return `Selected ${skill} over manual alternatives to improve execution speed, reliability, and architectural scalability.`
}


