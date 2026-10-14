-- Funnel report: distinct sessions reaching each step, by acquisition variant
-- and campaign. Adjust the date range in the "events" CTE as needed.
with events as (
  select session_id, name, variant, properties,
         coalesce(utm_campaign, '(none)') as campaign
  from funnel_events
  where occurred_at >= now() - interval '30 days'
)
select
  variant,
  campaign,
  count(distinct session_id) filter (where name = 'page_view')       as visits,
  count(distinct session_id) filter (where name = 'comparison_view') as viewed_comparison,
  count(distinct session_id) filter (where name = 'calculator_used') as used_calculator,
  count(distinct session_id) filter (where name = 'cta_click')       as clicked_cta,
  count(distinct session_id) filter (where name = 'form_start')      as started_form,
  count(distinct session_id) filter (where name = 'form_submit')     as submitted_form,
  count(distinct session_id) filter (where name = 'lead_created')    as leads_saved,
  count(distinct session_id) filter (
    where name = 'lead_created' and properties ->> 'lead_status' = 'new'
  )                                                                  as new_leads,
  count(distinct session_id) filter (where name = 'guide_download')  as downloaded_guide,
  round(
    100.0 * count(distinct session_id) filter (where name = 'lead_created')
      / nullif(count(distinct session_id) filter (where name = 'page_view'), 0),
    1
  )                                                                  as visit_to_lead_pct
from events
group by variant, campaign
order by variant, visits desc, campaign;
