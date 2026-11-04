/**
 * interviewDefenseGenerator.js
 * In-engine dynamic interview script and resume sentence generator.
 * Zero API calls, zero latency, 100% deterministic & tailored.
 */

export function getTalkingScript(skill, targetRole = 'Data Analyst', company = 'PwC USA') {
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

export function getResumeSentence(skill, company = 'PwC USA') {
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

