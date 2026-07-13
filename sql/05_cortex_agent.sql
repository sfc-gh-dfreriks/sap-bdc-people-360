-- =====================================================================
-- Cortex Agent — SAP_PEOPLE_ANALYST
-- Account-level agent for Snowflake Intelligence over the SAP_PEOPLE_360_ANALYTICS view.
-- Prereqs: 04_semantic_view.sql + SNOWFLAKE.CORTEX_USER on the executing role.
-- =====================================================================

CREATE OR REPLACE AGENT SAP_PEOPLE_360.AGENTS.SAP_PEOPLE_ANALYST
WITH PROFILE='{"display_name":"SAP People Analyst"}'
COMMENT='Natural-language analytics over SAP People 360 (headcount, attrition, diversity, compensation, tenure).'
FROM SPECIFICATION $$
{
  "models": {
    "orchestration": "auto"
  },
  "instructions": {
    "response": "Format headcount as whole numbers and salaries with currency. When relevant, break results out by department, division, or gender. Attrition rate = terminations / average headcount.",
    "orchestration": "You are an SAP People (HR) Analyst. Answer questions about workforce headcount, attrition/terminations, external hires, diversity (gender, generation, age band), compensation (annual salary, compa-ratio, pay grade), tenure, and organizational structure (department, division, location, company). Active employees have EMPLOYMENT_STATUS='Active' and HEADCOUNT=1. Terminations are counted via the TERMINATIONS fact. Use the WORKFORCE table."
  },
  "tools": [
    {
      "tool_spec": {
        "type": "cortex_analyst_text_to_sql",
        "name": "query_people_data",
        "description": "Query SAP workforce data: headcount, attrition, hires, diversity, compensation, tenure, org structure."
      }
    }
  ],
  "tool_resources": {
    "query_people_data": {
      "execution_environment": {
        "query_timeout": 299,
        "type": "warehouse",
        "warehouse": "LOAD_WH"
      },
      "semantic_view": "SAP_PEOPLE_360.SEMANTIC.SAP_PEOPLE_360_ANALYTICS"
    }
  }
}
$$;
