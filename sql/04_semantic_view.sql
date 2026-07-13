-- =====================================================================
-- Semantic layer — SAP_PEOPLE_360_ANALYTICS semantic view
-- Powers the Native App 'Ask the Agent' page and the account-level
-- SAP_PEOPLE_ANALYST Cortex Agent (see 05_cortex_agent.sql).
-- =====================================================================

create or replace semantic view SAP_PEOPLE_360.SEMANTIC.SAP_PEOPLE_360_ANALYTICS
	tables (
		WORKFORCE as SAP_PEOPLE_360.ANALYTICS.DT_WORKFORCE_360 primary key (EMPLOYEE_ID) with synonyms=('employees','workforce','headcount','staff','people') comment='Employee-level workforce fact with org, demographics, compensation, tenure, movement.'
	)
	facts (
		WORKFORCE.HEADCOUNT as HEADCOUNT comment='1 for active employees at end of period.',
		WORKFORCE.TERMINATIONS as TERMINATIONS comment='1 if the employee was terminated.',
		WORKFORCE.EXTERNAL_HIRES as EXTERNAL_HIRES comment='1 if hired externally in the last year.',
		WORKFORCE.FTE as FTE comment='Full-time equivalent.',
		WORKFORCE.ANNUAL_SALARY as ANNUAL_SALARY with synonyms=('salary','pay','compensation') comment='Annual base salary.',
		WORKFORCE.COMPA_RATIO as COMPA_RATIO comment='Salary divided by pay-grade midpoint.',
		WORKFORCE.TENURE_YEARS as TENURE_YEARS comment='Years of organizational tenure.',
		WORKFORCE.DIRECT_REPORTS as DIRECT_REPORTS comment='Number of direct reports.'
	)
	dimensions (
		WORKFORCE.EMPLOYEE_ID as EMPLOYEE_ID with synonyms=('employee','worker id') comment='Employee identifier.',
		WORKFORCE.DEPARTMENT as DEPARTMENT with synonyms=('dept','function') comment='Department name.',
		WORKFORCE.DIVISION as DIVISION with synonyms=('region','business unit') comment='Division/region.',
		WORKFORCE.LOCATION as LOCATION with synonyms=('office','site') comment='Work location.',
		WORKFORCE.COMPANY as COMPANY with synonyms=('legal entity','company code') comment='Company/operating entity.',
		WORKFORCE.JOB_TITLE as JOB_TITLE with synonyms=('title','role') comment='Job title.',
		WORKFORCE.PAY_GRADE as PAY_GRADE comment='Pay grade level.',
		WORKFORCE.GENDER as GENDER comment='Gender.',
		WORKFORCE.GENERATION as GENERATION comment='Generational cohort.',
		WORKFORCE.AGE_BAND as AGE_BAND with synonyms=('age group') comment='Age band.',
		WORKFORCE.EMPLOYMENT_STATUS as EMPLOYMENT_STATUS with synonyms=('status','active') comment='Active or Terminated.',
		WORKFORCE.EMPLOYEE_TYPE as EMPLOYEE_TYPE comment='Regular or Contingent.',
		WORKFORCE.EMPLOYMENT_TYPE as EMPLOYMENT_TYPE comment='Full-Time or Part-Time.',
		WORKFORCE.IS_MANAGER as IS_MANAGER comment='True if a people manager.',
		WORKFORCE.IS_CRITICAL_POSITION as IS_CRITICAL_POSITION comment='True if a critical position.',
		WORKFORCE.TENURE_BAND as TENURE_BAND with synonyms=('tenure group') comment='Tenure band.',
		WORKFORCE.TERMINATION_REASON as TERMINATION_REASON comment='Reason for termination.',
		WORKFORCE.HIRE_YEAR as HIRE_YEAR comment='Year of hire.',
		WORKFORCE.CURRENCY as CURRENCY comment='Salary currency.'
	)
	comment='SAP People 360 workforce analytics: headcount, attrition, diversity, compensation, tenure.';
