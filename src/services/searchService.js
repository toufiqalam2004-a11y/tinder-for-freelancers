/**
 * Global Search Service (V6)
 * Multi-entity fast search engine across Jobs, Companies, Clients, Sources, and Applications.
 */

import { getJobs, getApplications, getSources, getLeads } from '../data/storage.js';

class SearchService {
  search(query = '') {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        jobs: [],
        companies: [],
        applications: [],
        sources: [],
        leads: [],
        totalResults: 0,
      };
    }

    const jobs = getJobs();
    const applications = getApplications();
    const sources = getSources();
    const leads = getLeads();

    // 1. Search Jobs
    const matchedJobs = jobs
      .filter((j) => {
        const title = (j.title || '').toLowerCase();
        const desc = (j.description || '').toLowerCase();
        const role = (j.jobRole || '').toLowerCase();
        const company = (j.company || '').toLowerCase();
        const skills = (j.requiredSkills || []).map((s) => (typeof s === 'string' ? s : s.name || '').toLowerCase());

        return (
          title.includes(q) ||
          desc.includes(q) ||
          role.includes(q) ||
          company.includes(q) ||
          skills.some((s) => s.includes(q))
        );
      })
      .slice(0, 10);

    // 2. Search Companies / Clients
    const companyMap = new Map();
    jobs.forEach((j) => {
      const compName = j.company || j.client;
      if (compName && compName.toLowerCase().includes(q) && !companyMap.has(compName.toLowerCase())) {
        companyMap.set(compName.toLowerCase(), {
          name: compName,
          platform: j.platform,
          jobCount: jobs.filter((x) => (x.company || x.client) === compName).length,
          lastSeenJobId: j.id,
        });
      }
    });
    leads.forEach((l) => {
      const name = l.company || l.name;
      if (name && name.toLowerCase().includes(q) && !companyMap.has(name.toLowerCase())) {
        companyMap.set(name.toLowerCase(), {
          name,
          platform: l.platform,
          jobCount: 1,
          leadId: l.id,
        });
      }
    });
    const matchedCompanies = Array.from(companyMap.values()).slice(0, 6);

    // 3. Search Applications
    const matchedApplications = applications
      .filter((a) => {
        const title = (a.title || a.jobTitle || '').toLowerCase();
        const company = (a.company || '').toLowerCase();
        const status = (a.status || '').toLowerCase();
        return title.includes(q) || company.includes(q) || status.includes(q);
      })
      .slice(0, 6);

    // 4. Search Sources
    const matchedSources = sources
      .filter((s) => {
        const name = (s.name || '').toLowerCase();
        const plat = (s.platform || '').toLowerCase();
        return name.includes(q) || plat.includes(q);
      })
      .slice(0, 5);

    // 5. Search Leads
    const matchedLeads = leads
      .filter((l) => {
        const name = (l.name || '').toLowerCase();
        const comp = (l.company || '').toLowerCase();
        const title = (l.title || '').toLowerCase();
        return name.includes(q) || comp.includes(q) || title.includes(q);
      })
      .slice(0, 6);

    const totalResults =
      matchedJobs.length +
      matchedCompanies.length +
      matchedApplications.length +
      matchedSources.length +
      matchedLeads.length;

    return {
      jobs: matchedJobs,
      companies: matchedCompanies,
      applications: matchedApplications,
      sources: matchedSources,
      leads: matchedLeads,
      totalResults,
    };
  }
}

export const searchService = new SearchService();
