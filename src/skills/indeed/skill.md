This is indeed scrapping service.
It should get all job list detail from indeed platform

Here is workflow
1. get order with query, location, sort and fromage.
Ex, query: software, location : remote, sort : date, fromage : 7.

2. go to url
https://www.indeed.com/jobs?q=software&l=remote&sort=date&fromage=7&start=0

3. after loading is completed, find all job ids
const liElements = document.querySelectorAll('li.css-1ac2h1w');

// Extract ids from the a tags inside each li
const jobIds = Array.from(liElements).map(li => {
    const job = li.querySelector('a');
    return job ? job.id : null;
}).filter(id => id);

4. click each job id and get viewjob api response.
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
    if (url.includes('/viewjob')) {
        console.log('🎯 Target API Called:', url);
        const response = await originalFetch.apply(this, arguments);
        const clone = response.clone();
        const data = await clone.json();
        console.log('🎯 API Result:', data);
        return response;
    }
    return originalFetch.apply(this, arguments);
};

use this code to get viewjob response and send it to backend.
backend should save it in results field of that order.
Parameter should be : jobId, jobDetail
This step must be done one by one per job id. only click next job id after prev viewjob is completed.

5. after finish job detail searching, go to next page.
before it, check if next page is exist
const nextButton = document.querySelector('a[data-testId="pagination-page-next"]');

if (nextButton) {
    console.log('Element exists!');
    // Do something with it
} else {
    console.log('Element does not exist');
}

If exist, go to next page
next page url is
https://www.indeed.com/jobs?q=software&l=remote&sort=date&fromage=7&start=10
next page url's start parameter increase 10 per page. 0,10,20...
repeat previous steps.

if not, stop order and send order complete api
