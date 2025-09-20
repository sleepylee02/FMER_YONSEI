# FMER_YONSEI - Find me empty room in Yonsei
Hello this is a project to find empty room when you have time to wander around the Yonsei campus.

[TRY IT OUT](https://sleepylee02.github.io/FMER_YONSEI/frontend/)

It is a simple project consisted of few parts.
1. Crawler - to crawl the schedule of each building and room inside Yonsei.
2. Frontend - fronend that shows which rooms are empty in the building.
3. Workflow - yaml file to activate github action that will enable uploading the githubiopage and auto start the crawler every week

The project was made as simple as possible for quick devlopment and to use github action inside the range of free tier.

## Crawler
Nothing special just a crawler that crawls from the website
1. It goes through the authentication process
2. It crawls every building and every room
3. To crawl, it uses the AJAX request instead of parsing the html to minimize the effort
4. Crawls information for one week
5. Save it as a jsonl format

## Frontend
Nothing special just a simple frontend made of html, css, and js.
When you select the date, duration of time you want to stay, and the building you want to stay;
It retreives you the empty room to stay. 

Logic used to filter the room was to find the occupied room from the crawled data and show the remaining rooms that are empty.

## Workflow
Nothing special but simple automization on uploading github io page and auto crawling every monday 1am kst.

## Project Structure
```
.
├── crawling
│   ├── main.py
│   └── requirements.txt
├── frontend
│   ├── data
│   │   ├── building.json
│   │   └── schedule.jsonl
│   ├── index.html
│   ├── script.js
│   └── style.css
└── README.md
```

## TO reproduce
use .env for local crawling
use github action repo secret to deploy

