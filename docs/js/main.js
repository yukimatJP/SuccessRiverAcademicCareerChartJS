const $ = (id) => document.getElementById(id);
const DISPLAY_OPTION_LS_KEY = "CareerChartDisplayOptions";
const CAREER_EVENTS_LS_KEY  = "CareerChartCareerEvents";

const JSONL = {
  parse: (jsonl) => {
    let jsonlArray = jsonl.split("\n").filter(s => s !== "");
    let jsonlObj = {};
    for(let i=0; i<jsonlArray.length; i++) {
      let jsonlRow = JSON.parse(jsonlArray[i]);
      if(!(jsonlRow.insert.type in jsonlObj)) jsonlObj[jsonlRow.insert.type] = [];
      jsonlObj[jsonlRow.insert.type].push(jsonlRow.merge);
    }
    return jsonlObj;
  }
};

var app = new Vue({
  delimiters: ['${', '}'],
  el: '#app',
  data: {
    isSharingMode:   false,
    isEmbeddingMode: false,
    isPrintingMode:  false,
    rmFile: null,
    rmJson: null,
    researcher: {
      name: {
        ja: [],
        en: [],
        display: ''
      },
      affiliation: {
        display: ''
      }
    },
    career: {
      educationsAndJobs: [],
      grants: [],
      achievements: {
        journal:      {total: 0},
        intlConf:     {total: 0},
        domesticConf: {total: 0},
        total: 0,
      },
      events: [
        { date: "", content: "" }
      ]
    },
    chart: {
      firstYear: new Date().getFullYear(),
      latestYear: 0,
      settings: {
        cellWidth: 50,
        visibility: {
          journal:      true,
          intlConf:     true,
          domesticConf: true,
          notFirstCorrespAchievement: true,
          notReviewedAchievement: true,
          notPIgrants:  true,
          notKakenhiGrants: true,
        }
      },
      educationsAndJobs: [],
      grants: [],
      achievements: {
        journal:      [],
        intlConf:     [],
        domesticConf: [],
      },
      events: [],
      eventRowHeight: 30,
    },
    achievementTypeList: ['journal', 'intlConf', 'domesticConf'],
    achievementNameList: {'journal': '論文誌・ジャーナル', 'intlConf': '国際会議プロシーディングス', 'domesticConf': '国内研究会・シンポジウム'},
    importData: '',
    careerEventLayoutFrame: null,
  },
  beforeDestroy: function() {
    if (this.careerEventLayoutFrame !== null) {
      cancelAnimationFrame(this.careerEventLayoutFrame);
    }
  },
  methods: {
    initialize: function() {
      this.loadDisplayOptions();
      this.loadCareerEvents();
      let params = new URLSearchParams(window.location.search);
      if(params.has('chart')) {
        this.isSharingMode = true;
        this.importData = params.get('chart');
        this.importChart();
      }
      if(params.has('embed')) this.isEmbeddingMode = true;
      if(params.has('print')) this.isPrintingMode = true;
    },
    resetPage: function() {
      this.clearCareerChart();
      window.location.search = '';
    },
    saveDisplayOptions: function() {
      try {
        const payload = {
          cellWidth: Number(this.chart.settings.cellWidth),
          visibility: {
            journal:      Boolean(this.chart.settings.visibility.journal),
            intlConf:     Boolean(this.chart.settings.visibility.intlConf),
            domesticConf: Boolean(this.chart.settings.visibility.domesticConf),
            notFirstCorrespAchievement: Boolean(this.chart.settings.visibility.notFirstCorrespAchievement),
            notReviewedAchievement: Boolean(this.chart.settings.visibility.notReviewedAchievement),
            notPIgrants:  Boolean(this.chart.settings.visibility.notPIgrants),
            notKakenhiGrants: Boolean(this.chart.settings.visibility.notKakenhiGrants),
          }
        };
        localStorage.setItem(DISPLAY_OPTION_LS_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn("Failed to save display options:", e);
      }
    },
    loadDisplayOptions: function() {
      try {
        const raw = localStorage.getItem(DISPLAY_OPTION_LS_KEY);
        if (!raw) return;

        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return;

        if (typeof data.cellWidth === "number" && isFinite(data.cellWidth)) {
          const cw = Math.min(200, Math.max(30, Math.round(data.cellWidth)));
          this.chart.settings.cellWidth = cw;
        }

        if (data.visibility && typeof data.visibility === "object") {
          const v = data.visibility;
          const vis = this.chart.settings.visibility;
          if ("journal" in v)      vis.journal = Boolean(v.journal);
          if ("intlConf" in v)     vis.intlConf = Boolean(v.intlConf);
          if ("domesticConf" in v) vis.domesticConf = Boolean(v.domesticConf);
          if ("notFirstCorrespAchievement" in v) vis.notFirstCorrespAchievement = Boolean(v.notFirstCorrespAchievement);
          if ("notReviewedAchievement" in v) vis.notReviewedAchievement = Boolean(v.notReviewedAchievement);
          if ("notPIgrants" in v)  vis.notPIgrants = Boolean(v.notPIgrants);
          if ("notKakenhiGrants" in v) vis.notKakenhiGrants = Boolean(v.notKakenhiGrants);
        }
      } catch (e) {
        console.warn("Failed to load display options:", e);
      }
    },
    selectResearchmapFile: function(e) {
      this.clearCareerChart();
      const files = e.target.files || e.dataTransfer.files;
      if (!files || !files[0]) return;
      const f = files[0];
      if (f.name.split('.').pop().toLowerCase() !== 'jsonl') {
        alert("jsonlファイルを選択してください");
        return;
      }
      this.rmFile = f;
      const reader = new FileReader();
      reader.readAsText(this.rmFile);
      reader.onload = () => {
        this.rmJson = JSONL.parse(reader.result);
        this.parseCareerData();
        this.plotCareerChart();
      };
    },
    clearCareerChart: function() {
      this.rmFile = null;
      this.rmJson = null;

      this.importData = '';

      this.researcher = {
        name: { ja: [], en: [], display: '' },
        affiliation: { display: '' }
      };

      this.career = {
        educationsAndJobs: [],
        grants: [],
        achievements: {
          journal:      { total: 0 },
          intlConf:     { total: 0 },
          domesticConf: { total: 0 },
          total: 0
        },
        events: [{ date: "", content: "" }],
      };

      this.chart.firstYear = new Date().getFullYear();
      this.chart.latestYear = 0;

      this.loadDisplayOptions();
      this.loadCareerEvents();

      this.chart.educationsAndJobs = [];
      this.chart.grants = [];
      this.chart.achievements = { journal: [], intlConf: [], domesticConf: [] };
      this.chart.events = [];

      const root = document.documentElement;
      root.style.setProperty('--col-width', this.chart.settings.cellWidth + "px");
      root.style.setProperty('--row-width', "50px");
      root.style.setProperty('--future-cols', 2);
      root.style.setProperty('--chart-header-position', "0px");

      const sc = document.querySelector(".career-chart");
      if (sc) sc.scrollLeft = 0;
    },
    parseCareerData() {
      // Basic Info
      if('researchers' in this.rmJson) {
        let researcher = this.rmJson.researchers[0];
        this.researcher.name.ja = [
          researcher.family_name.ja + " " + researcher.given_name.ja,
          researcher.family_name.ja +       researcher.given_name.ja,
        ];
        this.researcher.name.en = [
          researcher.family_name.en + " " + researcher.given_name.en,
          researcher.given_name.en  + " " + researcher.family_name.en,
        ];
        this.researcher.name.display = researcher.family_name.ja + " " + researcher.given_name.ja
                              + " (" + researcher.given_name.en  + " " + researcher.family_name.en + ")";
        this.researcher.affiliation.display = researcher.affiliations[0].affiliation.ja;
      }
      // Education History
      for(let i=0; i<this.rmJson.education.length; i++) {
        let edu = this.rmJson.education[i];
        let yearFrom = this.getFinancialYear(edu.from_date);
        let yearTo   = this.getFinancialYear(edu.to_date);
        let eduAffiliation = this.getEduAffiliation(edu.affiliation);
        let eduName = [];
        if('department' in edu) eduName.push(this.getEduName(edu.department));
        if('course' in edu) eduName.push(this.getEduName(edu.course));
        if(eduAffiliation != '') eduName.push("（" + eduAffiliation + "）");
        this.career.educationsAndJobs.push({yearFrom, yearTo, name:eduName.join(" "), isEdu:true});
        this.updateCareerPeriod(yearFrom.year, yearTo.year);
      }
      // Job History
      for(let i=0; i<this.rmJson.research_experience.length; i++) {
        let job = this.rmJson.research_experience[i];
        let yearFrom = this.getFinancialYear(job.from_date);
        let yearTo   = this.getFinancialYear(job.to_date);
        let jobName  = ('job' in job) ? this.getJobName(job) : '';
        this.career.educationsAndJobs.push({yearFrom, yearTo, name:jobName, isEdu:false});
        this.updateCareerPeriod(yearFrom.year, yearTo.year);
      }
      // Grant History
      for(let i=0; i<this.rmJson.research_projects.length; i++) {
        let grant = this.rmJson.research_projects[i];
        let yearFrom  = this.getFinancialYear(grant.from_date);
        let yearTo    = this.getFinancialYear(grant.to_date);
        let grantName = this.getGrantName(grant);
        let grantRole = !('research_project_owner_role' in grant) ? 'undefined'
                      : grant.research_project_owner_role == 'principal_investigator' ? 'principal'
                      : grant.research_project_owner_role == 'coinvestigator' ? 'coinvestigator'
                      : 'others';
        const offerOrganization = ('offer_organization' in grant)
          ? (grant.offer_organization.ja || grant.offer_organization.en || '') : '';
        const systemName = ('system_name' in grant)
          ? (grant.system_name.ja || grant.system_name.en || '') : '';
        const isKakenhi = offerOrganization.includes('日本学術振興会')
          && systemName.includes('科学研究費助成事業');
        this.career.grants.push({'yearFrom': yearFrom, 'yearTo': yearTo, 'name': grantName, 'role': grantRole, 'isKakenhi': isKakenhi});
        this.updateCareerPeriod(yearFrom.year, yearTo.year);
      }
      // Achievement History (paper)
      for(let i=0; i<this.rmJson.published_papers.length; i++) {
        let achvmnt = this.rmJson.published_papers[i];
        if (!('published_paper_type' in achvmnt)) continue;

        let achvmntType = achvmnt.published_paper_type == 'scientific_journal' ? 'journal'
          : achvmnt.published_paper_type == 'international_conference_proceedings' ? 'intlConf'
          : achvmnt.published_paper_type == 'symposium' ? 'domesticConf' : '';

        if(achvmntType == '') continue;

        let firstAuthorFlag = false;
        let correspAuthorFlag = false;

        if('published_paper_owner_roles' in achvmnt) {
          firstAuthorFlag = achvmnt.published_paper_owner_roles.includes('lead');
          correspAuthorFlag = achvmnt.published_paper_owner_roles.includes('corresponding');
        }
        if(!firstAuthorFlag && 'en' in achvmnt.authors) {
          firstAuthorFlag = this.researcher.name.en.includes(achvmnt.authors.en[0].name);
        }
        if(!firstAuthorFlag && 'ja' in achvmnt.authors) {
          firstAuthorFlag = this.researcher.name.ja.includes(achvmnt.authors.ja[0].name);
        }

        achvmntYear = this.getFinancialYear(achvmnt.publication_date).year;

        if(!(achvmntYear in this.career.achievements[achvmntType])) {
          this.career.achievements[achvmntType][achvmntYear] = {
            firstCorresp: 0, first: 0, corresp: 0, other: 0, total: 0,
            reviewed: {firstCorresp: 0, first: 0, corresp: 0, other: 0, total: 0}
          };
        }

        let roleKey = (firstAuthorFlag && correspAuthorFlag) ? 'firstCorresp'
                    : firstAuthorFlag ? 'first'
                    : correspAuthorFlag ? 'corresp'
                    : 'other'

        this.career.achievements[achvmntType][achvmntYear][roleKey]++;
        this.career.achievements[achvmntType][achvmntYear].total++;
        if(achvmnt.referee === true) {
          this.career.achievements[achvmntType][achvmntYear].reviewed[roleKey]++;
          this.career.achievements[achvmntType][achvmntYear].reviewed.total++;
        }
        this.career.achievements[achvmntType].total++;
        this.career.achievements.total++;
        this.updateCareerPeriod(achvmntYear, achvmntYear);
      }
    },
    getFinancialYear(targetDate, isFrom) {
      if(targetDate == "9999" || targetDate == undefined || targetDate == null) {
        return {year:new Date().getFullYear()+1, month:isFrom ? 4 : 3};
      }
      let dt = targetDate.split('-');
      let year  = (dt.length > 0) ? parseInt(dt[0]) : new Date().getFullYear();
      let month = (dt.length > 1) ? parseInt(dt[1]) : isFrom ? 4 : 3;
      return {'year': year, 'month': month}
    },
    updateCareerPeriod(yearFrom, yearTo) {
      if(this.chart.firstYear  > yearFrom) { this.chart.firstYear  = yearFrom; }
      if(this.chart.latestYear < yearTo  ) { this.chart.latestYear = Math.min(new Date().getFullYear(), yearTo); }
    },
    getEduAffiliation(edu) {
      if('ja' in edu) {
        return edu.ja;
      } else if('en' in edu) {
        return edu.en;
      }
    },
    getEduName(edu) {
      if('ja' in edu) {
        // if     (edu.ja.includes("修士"))       { return '修士課程'; }
        // else if(edu.ja.includes("修士課程"))    { return '修士課程'; }
        // else if(edu.ja.includes("博士前期課程")) { return '博士前期課程'; }
        // else if(edu.ja.includes("博士後期課程")) { return '博士後期課程'; }
        // else if(edu.ja.includes("博士課程"))    { return '博士課程'; }
        // else if(edu.ja.includes("博士"))       { return '博士課程'; }
        // else if(edu.ja.includes("研究科"))     { return '大学院'; }
        return edu.ja;
      } else if('en' in edu) {
        return edu.en;
      }
    },
    getJobName(job) {
      let lang = ('ja' in job.job) ? 'ja' : 'en';
      let jobName = "";
      let jobAffiliation = [];
      if('affiliation' in job) {
        jobAffiliation.push(this.getOrgAbbreviation(job.affiliation[lang]));
      }
      if('section' in job) {
        jobAffiliation.push(job.section[lang]);
      }
      if('job' in job) {
        jobName = job.job[lang] + " （" + jobAffiliation.join(" ") + ")";
      }

      if(lang == 'ja' && jobName.includes("JSPS")) {
        jobName = jobName.includes("DC1") ? "学振DC1"
                : jobName.includes("DC2") ? "学振DC2"
                : jobName.includes("RPD") ? "学振RPD"
                : jobName.includes("SPD") ? "学振SPD"
                : jobName.includes("PD")  ? "学振PD"  : jobName;
      }
      return jobName;
    },
    getGrantName(grant) {
      let grantName = '';
      if(grantName == '' && 'offer_organization' in grant) {
        let grantOrg = grant.offer_organization[('ja' in grant.offer_organization) ? 'ja' : 'en'];
        grantName = this.getOrgAbbreviation(grantOrg);
        if('category' in grant) {
          grantName += "&nbsp;" + grant.category[('ja' in grant.category) ? 'ja' : 'en'];
        } else if('system_name' in grant) {
          grantName += "&nbsp;" + grant.system_name[('ja' in grant.system_name) ? 'ja' : 'en'];
        }
      }
      return grantName;
    },
    getOrgAbbreviation(org) {
      if(org.indexOf("科学技術振興機構") > -1) return "JST";
      if(org.indexOf("日本学術振興会") > -1 || org.indexOf("学振") > -1) return "JSPS";
      if(org.indexOf("新エネルギー・産業技術総合開発機構") > -1) return "NEDO";
      if(org.indexOf("日本医療研究開発機構") > -1) return "AMED";
      if(org.indexOf("情報通信研究機構") > -1) return "NICT";
      if(org.indexOf("理化学研究所") > -1) return "RIKEN";
      return org;
    },
    addCareerEventRow: function() {
      this.career.events.push({ date: "", content: "" });
      this.saveCareerEvents();
    },
    removeCareerEventRow: function(idx) {
      if (this.career.events.length <= 1) {
        this.career.events = [{ date: "", content: "" }];
      } else {
        this.career.events.splice(idx, 1);
      }
      this.saveCareerEvents();
    },
    sortCareerEvents: function () {
      this.career.events.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    },
    saveCareerEvents: function() {
      try {
        const cleaned = (this.career.events || [])
          .map(e => ({
            date: (e && typeof e.date === "string") ? e.date.trim() : "",
            content: (e && typeof e.content === "string") ? e.content.trim() : ""
          }))
          .filter(e => e.date !== "" || e.content !== "");
        localStorage.setItem(CAREER_EVENTS_LS_KEY, JSON.stringify(cleaned));
      } catch (e) {
        console.warn("Failed to save career events:", e);
      }
      this.replotCareerChart();
    },
    loadCareerEvents: function() {
      try {
        const raw = localStorage.getItem(CAREER_EVENTS_LS_KEY);
        if (!raw) return;

        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;

        const normalized = arr.map(e => ({
          date: (e && typeof e.date === "string") ? e.date : "",
          content: (e && typeof e.content === "string") ? e.content : ""
        }));

        this.career.events = normalized.length ? normalized : [{ date: "", content: "" }];
        this.sortCareerEvents();
      } catch (e) {
        console.warn("Failed to load career events:", e);
      }
    },
    plotCareerChart() {
      // set CSS property
      this.updateCellWidth();
      // check data
      if(this.career.educationsAndJobs.length == 0 && this.career.grants.length == 0) return;
      // Education and Job History
      let edujob = this.career.educationsAndJobs.sort((a, b) => a.yearFrom.year - b.yearFrom.year);
      for(let i=0; i<edujob.length; i++) {
        let newItem = this.getEducationAndJobItem(edujob[i]);
        if(this.chart.educationsAndJobs.length == 0) {
          this.chart.educationsAndJobs.push([newItem]);
        } else {
          for(let j=0; j<this.chart.educationsAndJobs.length; j++) {
            if(this.chart.educationsAndJobs[j][0].from > newItem.to) {
              this.chart.educationsAndJobs[j].unshift(newItem);
              break;
            } else if(this.chart.educationsAndJobs[j][this.chart.educationsAndJobs[j].length-1].to < newItem.from) {
              this.chart.educationsAndJobs[j].push(newItem);
              break;
            } else if(j == this.chart.educationsAndJobs.length - 1) {
              this.chart.educationsAndJobs.push([newItem]);
              break;
            }
          }
        }
      }
      // Grant History
      let grants = this.career.grants.sort((a, b) => a.yearFrom.year - b.yearFrom.year);
      for(let i=0; i<grants.length; i++) {
        let newItem = this.getGrantItem(grants[i]);
        if((this.chart.settings.visibility.notPIgrants || newItem.isPI)
          && (this.chart.settings.visibility.notKakenhiGrants || newItem.isKakenhi)) {
          if(this.chart.grants.length == 0) {
            this.chart.grants.push([newItem]);
          } else {
            for(let j=0; j<this.chart.grants.length; j++) {
              if(this.chart.grants[j][0].from > newItem.to) {
                this.chart.grants[j].unshift(newItem);
                break;
              } else if(this.chart.grants[j][this.chart.grants[j].length-1].to < newItem.from) {
                this.chart.grants[j].push(newItem);
                break;
              } else if(j == this.chart.grants.length - 1) {
                this.chart.grants.push([newItem]);
                break;
              }
            }
          }
        }
      }
      // Achievement History (paper)
      for(let achvmntType of this.achievementTypeList) {
        this.chart.achievements[achvmntType] = {};
        for(let i=this.chart.firstYear; i<=this.chart.latestYear; i++) {
          let year = String(i);
          if(year in this.career.achievements[achvmntType]) {
            let achvmnt = this.career.achievements[achvmntType][year];
            if(!this.chart.settings.visibility.notReviewedAchievement && achvmnt.reviewed) {
              achvmnt = achvmnt.reviewed;
            }
            let firstCorrespCount = achvmnt.firstCorresp + achvmnt.first + achvmnt.corresp;
            this.chart.achievements[achvmntType][year] = Array(firstCorrespCount).fill(1).concat(Array(achvmnt.other).fill(0));
          } else {
            this.chart.achievements[achvmntType][year] = [];
          }
        }
      }
      // Career Events
      this.chart.events = [];
      const evs = (this.career.events || [])
        .filter(e => e && (e.date || e.content))
        .map(e => ({
          date: (typeof e.date === "string") ? e.date.trim() : "",
          content: (typeof e.content === "string") ? e.content.trim() : ""
        }))
        .filter(e => e.date !== "");
      evs.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < evs.length; i++) {
        const it = this.getCareerEventItem(evs[i]);
        this.chart.events.push(it);
        this.updateCareerPeriod(it.year, it.year);
      }
      this.updateCellWidth();
      this.$nextTick(this.layoutCareerEvents);
    },
    replotCareerChart() {
      // save display options
      this.saveDisplayOptions();
      // reset plot data
      this.chart.educationsAndJobs = [];
      this.chart.grants = [];
      this.chart.achievements = { journal: [], intlConf: [], domesticConf: [] };
      this.plotCareerChart();
    },
    getEducationAndJobItem(item) {
      return {
        from:  parseFloat((item.yearFrom.year + item.yearFrom.month / 12.0).toFixed(2)),
        to:    parseFloat((item.yearTo.year   + item.yearTo.month   / 12.0).toFixed(2)),
        name:  item.name,
        isEdu: item.isEdu,
      };
    },
    getGrantItem(item) {
      return {
        from: parseFloat((item.yearFrom.year + item.yearFrom.month / 12.0).toFixed(2)),
        to:   parseFloat((item.yearTo.year   + item.yearTo.month   / 12.0).toFixed(2)),
        name: item.name,
        isPI: item.role == 'principal',
        isKakenhi: Boolean(item.isKakenhi),
      };
    },
    getCareerEventItem(e) {
      const dt = String(e.date).split("-");
      const y = (dt.length > 0) ? parseInt(dt[0]) : new Date().getFullYear();
      const m = (dt.length > 1) ? parseInt(dt[1]) : 1;
      const pos = parseFloat((y + ((m - 1) / 12.0)).toFixed(2));
      const mm = String(m).padStart(2, "0");
      const label = (e.content && e.content !== "") ? e.content : "";
      return {
        year: y,
        pos: pos,
        label: label,
        level: 0,
        zIndex: 1000000 - Math.round(pos * 12)
      };
    },
    getEventCellStyle(item) {
      const level = Number(item.level) || 0;
      return {
        left: (this.chart.settings.cellWidth * (item.pos - this.chart.firstYear)) + "px",
        bottom: (level * 30) + "px",
        zIndex: item.zIndex,
        "--event-line-height": (44 + level * 30) + "px"
      };
    },
    layoutCareerEvents() {
      const cells = Array.from(document.querySelectorAll(".career-event-cell"));
      if (!cells.length) {
        this.chart.eventRowHeight = 30;
        return;
      }

      const laneLeftEdges = [];
      const gap = 8;
      // Lay out newer events first so older overlapping events move upward.
      for (let i = cells.length - 1; i >= 0; i--) {
        const cell = cells[i];
        const left = cell.offsetLeft;
        const right = left + cell.offsetWidth;
        let level = laneLeftEdges.findIndex(edge => right + gap <= edge);
        if (level === -1) level = laneLeftEdges.length;
        laneLeftEdges[level] = left;
        this.chart.events[i].level = level;
      }
      this.chart.eventRowHeight = Math.max(30, laneLeftEdges.length * 30);
    },
    scheduleCareerEventLayout() {
      if (this.careerEventLayoutFrame !== null) {
        cancelAnimationFrame(this.careerEventLayoutFrame);
      }
      this.careerEventLayoutFrame = requestAnimationFrame(() => {
        this.careerEventLayoutFrame = null;
        this.layoutCareerEvents();
      });
    },
    updateCellWidth() {
      const cellWidth = Number(this.chart.settings.cellWidth);
      if(!isFinite(cellWidth) || cellWidth < 30 || cellWidth > 200) return;
      // save display options
      this.saveDisplayOptions();
      // update cell width
      let root = document.documentElement;
      let maxPosition = this.chart.latestYear + 3;
      for(const rows of [this.chart.educationsAndJobs, this.chart.grants]) {
        for(const row of rows) {
          for(const item of row) maxPosition = Math.max(maxPosition, Number(item.to) || 0);
        }
      }
      for(const item of this.chart.events) {
        maxPosition = Math.max(maxPosition, (Number(item.pos) || 0) + 1);
      }
      const futureColumns = Math.max(2, Math.ceil(maxPosition - (this.chart.latestYear + 1)));
      const yearColumns = Math.max(1, this.chart.latestYear - this.chart.firstYear + 1);
      root.style.setProperty('--col-width', cellWidth + "px");
      root.style.setProperty('--future-cols', futureColumns);
      root.style.setProperty('--row-width', cellWidth * (yearColumns + futureColumns) + "px");
      this.scheduleCareerEventLayout();
    },
    normalizeCellWidth() {
      const value = Number(this.chart.settings.cellWidth);
      this.chart.settings.cellWidth = isFinite(value)
        ? Math.min(200, Math.max(30, Math.round(value))) : 50;
      this.updateCellWidth();
    },
    onScrollChart(e) {
      const chart = e.currentTarget || e.target;
      document.documentElement.style.setProperty('--chart-header-position', chart.scrollLeft + "px");
    },
    getAchievementRowHeight(type) {
      let maxLength = 0;
      for([year, achvmnt] of Object.entries(this.chart.achievements[type])) {
        if(!this.chart.settings.visibility.notFirstCorrespAchievement) {
          achvmnt = achvmnt.filter(n => n == 1);
        }
        maxLength = Math.max(maxLength, achvmnt.length);
      }
      return maxLength;
    },
    getStackCellStyle(item) {
      return {
        width: (this.chart.settings.cellWidth * (item.to - item.from)) + 'px',
        left:  (this.chart.settings.cellWidth * (item.from - this.chart.firstYear)) + 'px'
      };
    },
    printChart() {
      this.isPrintingMode = true;
      this.$nextTick(() => {
        window.scrollTo(0, 0);
        const chart = document.querySelector(".career-chart");
        if(chart) chart.scrollLeft = 0;
        document.documentElement.style.setProperty('--chart-header-position', '0px');
        this.scheduleCareerEventLayout();
      });
    },
    exitPrintMode() {
      this.isPrintingMode = false;
      this.$nextTick(this.scheduleCareerEventLayout);
    },
    async exportHTML() {
      const src = document.querySelector(".career-chart-container");
      const sc = document.querySelector(".career-chart");
      if (!src || !sc) return alert("チャートが表示されていないため、HTMLを書き出せません。");

      const clone = src.cloneNode(true);

      // UI部品はHTMLから落とす
      ["header","footer",".file-select-container",".chart-setting-container",".career-chart-container h2",".export-chart"]
        .forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()));

      // Vueの属性は静的HTMLでは不要
      const rmAttrs = ["v-if","v-else","v-else-if","v-for","v-model","v-html",":class",":style",":id",":for","@click","@scroll","@change","@input"];
      clone.querySelectorAll("*").forEach(el => rmAttrs.forEach(a => el.hasAttribute(a) && el.removeAttribute(a)));

      const wrap = document.createElement("div");
      wrap.className = "app print";
      wrap.appendChild(clone);

      const cs = getComputedStyle(document.documentElement);
      const col = (cs.getPropertyValue("--col-width") || "50px").trim() || "50px";
      const row = (cs.getPropertyValue("--row-width") || "50px").trim() || "50px";
      const future = (cs.getPropertyValue("--future-cols") || "2").trim() || "2";
      const pos0 = (cs.getPropertyValue("--chart-header-position") || "").trim();
      const pos = pos0 || ((sc.scrollLeft || 0) + "px");
      const vars = `:root{--col-width:${col};--row-width:${row};--future-cols:${future};--chart-header-position:${pos};}`;

      const tmpDoc = document.implementation.createHTMLDocument("tmp");
      const st = tmpDoc.createElement("style");
      let sourceCss = Array.from(document.styleSheets).map(sheet => {
        try {
          return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join("\n");
        } catch(e) {
          return "";
        }
      }).filter(Boolean).join("\n");
      if(!sourceCss) {
        try {
          const response = await fetch("css/style.css");
          if(response.ok) sourceCss = await response.text();
        } catch(e) {}
      }
      if(!sourceCss) return alert("CSSを読み込めないため、HTMLを書き出せません。");
      st.textContent = sourceCss;
      tmpDoc.head.appendChild(st);

      const tmpRoot = tmpDoc.createElement("div");
      tmpRoot.innerHTML = wrap.outerHTML;
      tmpDoc.body.appendChild(tmpRoot);

      const css = pruneCSS(tmpDoc, tmpRoot);
      const extra = "html,body{margin:0;padding:0} .app.print .career-chart-container{padding:0!important} .app.print .career-chart{width:100vw;border:none}";

      const formatDom = (s) => {
        s = s.replace(/<\/([a-zA-Z0-9:-]+)>\s*</g, "</$1>\n<");
        s = s.replace(/\n{2,}/g, "\n");
        return s.trim();
      };

      const body = formatDom(wrap.outerHTML).trim() + "\n";
      const script = `(()=>{const chart=document.querySelector(".career-chart");if(!chart)return;const sync=()=>document.documentElement.style.setProperty("--chart-header-position",chart.scrollLeft+"px");chart.addEventListener("scroll",sync,{passive:true});sync()})();`;
      const html = `<!doctype html><html lang="ja"><!--  Author: Yuki Matsuda @yukimatJP //--><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AcademicCareerChart Export</title><style>${css}${vars}${extra}</style></head><body>${body}<script>${script}<\/script></body></html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "career-chart.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    importChart() {
      let d = this.importData.split('...').map(s => decodeURIComponent(s));
      this.researcher.name.display = decodeURI(d[0]);
      this.researcher.affiliation.display = decodeURI(d[1]);
      this.chart.firstYear = parseInt(d[2]) + 2000;
      this.chart.latestYear = parseInt(d[3]) + 2000;
      this.chart.settings.cellWidth = parseInt(d[4]);
      this.chart.settings.visibility.journal = Boolean(parseInt(d[5]));
      this.chart.settings.visibility.intlConf = Boolean(parseInt(d[6]));
      this.chart.settings.visibility.domesticConf = Boolean(parseInt(d[7]));
      this.chart.settings.visibility.notPIgrants = Boolean(parseInt(d[8]));
      this.chart.settings.visibility.notFirstCorrespAchievement = Boolean(parseInt(d[9]));
      // Education and Job History
      let eaj = JSON.parse("[" + d[10].replaceAll('__', '"') + "]");
      for(let i=0; i<parseInt(eaj.length/4); i++) {
        let eajItem = []
        let tmp = parseFloat(eaj[i*4]);
        let yearFrom = {
          year: parseInt(tmp + 2000),
          month: Math.ceil(12 * (tmp - parseInt(tmp)) * (tmp < 0 ? -1 : 1))
        };
        tmp = parseFloat(eaj[i*4 + 1]);
        let yearTo   = {
          year: parseInt(tmp + 2000),
          month: Math.floor(12 * (tmp - parseInt(tmp)) * (tmp < 0 ? -1 : 1))
        };
        let eduName  = decodeURI(eaj[i*4 + 2]);
        let isEdu    = Boolean(parseInt(eaj[i*4 + 3]));
        this.career.educationsAndJobs.push({'yearFrom': yearFrom, 'yearTo': yearTo, 'name': eduName, 'isEdu': isEdu});
      }
      // Grant History
      let grant = JSON.parse("[" + d[11].replaceAll('__', '"') + "]");
      let grantKakenhiFlags = (d.length >= 17 && d[16] && d[16] !== "undefined")
        ? JSON.parse("[" + d[16] + "]") : [];
      for(let i=0; i<parseInt(grant.length/4); i++) {
        let grantItem = []
        let tmp = parseFloat(grant[i*4]);
        let yearFrom = {
          year: parseInt(tmp + 2000),
          month: Math.ceil(12 * (tmp - parseInt(tmp)) * (tmp < 0 ? -1 : 1))
        };
        tmp = parseFloat(grant[i*4 + 1]);
        let yearTo   = {
          year: parseInt(tmp + 2000),
          month: Math.floor(12 * (tmp - parseInt(tmp)) * (tmp < 0 ? -1 : 1))
        };
        let grantName = decodeURI(grant[i*4 + 2]);
        let isPI      = Boolean(parseInt(grant[i*4 + 3]));
        let isKakenhi = (i < grantKakenhiFlags.length) ? Boolean(parseInt(grantKakenhiFlags[i])) : true;
        this.career.grants.push({'yearFrom': yearFrom, 'yearTo': yearTo, 'name': grantName, 'role': isPI ? 'principal' : 'coinvestigator', 'isKakenhi': isKakenhi});
      }
      // Achievement History (paper)
      let achievements = d[12].split(',');
      for(let i=0; i<achievements.length; i++) {
        let tmp = achievements[i].split('_');
        for(let j=0; j<tmp.length; j++) {
          let achvmntYear = String(j + this.chart.firstYear);
          if(this.achievementTypeList[i] != undefined && tmp[j] != '') {
            let [firstCorresp, other] = tmp[j].split('-');
            firstCorresp = (firstCorresp == '') ? 0 : parseInt(firstCorresp);
            other = (other == '') ? 0 : parseInt(other);
            this.career.achievements[this.achievementTypeList[i]][achvmntYear] = {
              'firstCorresp': firstCorresp, 'first': 0, 'corresp': 0, 'other': other, 'total': firstCorresp + other,
              'reviewed': {'firstCorresp': firstCorresp, 'first': 0, 'corresp': 0, 'other': other, 'total': firstCorresp + other}
            };
          }
        }
      }
      this.career.events = [{ date: "", content: "" }];
      if(d.length >= 14 && d[13] && d[13] !== "undefined") {
        try {
          const ev = JSON.parse("[" + d[13].replaceAll('__', '"') + "]");
          const restored = [];
          for(let i=0; i<parseInt(ev.length/2); i++) {
            const pos = parseFloat(ev[i*2]);
            const raw = (ev[i*2 + 1] != null) ? String(ev[i*2 + 1]) : "";
            if(!isFinite(pos)) continue;

            const content = decodeURI(raw);
            const t = pos + 2000.0;
            const y = Math.floor(t);
            let m = Math.round((t - y) * 12);
            if(m <= 0)  m = 1;
            if(m >= 12) m = 12;

            const mm = String(m).padStart(2, "0");
            restored.push({ date: `${y}-${mm}`, content });
          }
          this.career.events = restored.length ? restored : [{ date: "", content: "" }];
        } catch(e) {
          this.career.events = [{ date: "", content: "" }];
        }
      }
      if(d.length >= 15 && d[14] !== "" && d[14] !== "undefined") {
        this.chart.settings.visibility.notReviewedAchievement = Boolean(parseInt(d[14]));
      } else {
        this.chart.settings.visibility.notReviewedAchievement = true;
      }
      if(d.length >= 16 && d[15] !== "" && d[15] !== "undefined") {
        this.chart.settings.visibility.notKakenhiGrants = Boolean(parseInt(d[15]));
      } else {
        this.chart.settings.visibility.notKakenhiGrants = true;
      }
      this.updateCellWidth();
      this.replotCareerChart();
    }
  },
  computed: {
    systemVersion: function() { return 'v1.7'; }
  }
});

function pruneCSS(doc, rootEl) {
  const kept = [];
  const keepBase = new Set([":root","html","body","*","*::before","*::after","*:before","*:after"]);

  const split = s => s.split(",").map(x => x.trim()).filter(Boolean);
  const stripPseudo = s => s
    .replace(/::before|::after|:before|:after/gi, "")
    .replace(/:hover|:active|:focus-visible|:focus|:visited|:link/gi, "")
    .replace(/:disabled|:enabled|:checked|:target/gi, "")
    .replace(/:first-child|:last-child|:nth-child\([^)]+\)/gi, "")
    .replace(/:first-of-type|:last-of-type|:nth-of-type\([^)]+\)/gi, "")
    .trim();

  const match = (selectorText) => {
    if (keepBase.has(selectorText)) return true;
    for (const raw of split(selectorText)) {
      if (keepBase.has(raw)) return true;
      const s = stripPseudo(raw);
      if (!s) return true;
      try { if (rootEl.querySelector(s)) return true; }
      catch (e) { return true; }
    }
    return false;
  };

  const handle = (rule) => {
    const t = rule.type;
    if (t === CSSRule.FONT_FACE_RULE || t === CSSRule.KEYFRAMES_RULE) return kept.push(rule.cssText);

    if (t === CSSRule.MEDIA_RULE || t === (CSSRule.SUPPORTS_RULE || 12)) {
      const inner = [];
      for (const r of rule.cssRules) {
        if (r.type === CSSRule.STYLE_RULE) { if (match(r.selectorText)) inner.push(r.cssText); }
        else inner.push(r.cssText);
      }
      if (inner.length) {
        const head = (t === CSSRule.MEDIA_RULE) ? `@media ${rule.conditionText}` : `@supports ${rule.conditionText}`;
        kept.push(`${head}{${inner.join("")}}`);
      }
      return;
    }

    if (t === CSSRule.STYLE_RULE) { if (match(rule.selectorText)) kept.push(rule.cssText); return; }
    kept.push(rule.cssText);
  };

  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const r of Array.from(rules)) handle(r);
    } catch (e) {}
  }

  if (!kept.length) return Array.from(doc.querySelectorAll("style")).map(s => s.textContent || "").join("\n");
  return kept.join("");
}

app.initialize();
