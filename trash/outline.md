## First crawl information
https://space.yonsei.ac.kr/index.php?mid=K06&lang=k

building => crawl all room
crawl this week information and put it inside a db
connect it to the front and upload the info to github page
also run crawling via github actionx


1. we need to crawl all the building and the room inside the building
name="uBuilding"
name="uRoom"

2. crawl the name of the class and its time
class="fc-event-time"
class="fc-event-title"

3. should also include the day of the week
class="fc-first fc-last"
fc-wed fc-col2 fc-widget-header

4.
first save it as a json file

## make front end

connect it with a json file
make front that i can find empty room

## upgrade the process

connect it with db instead of json

## upload
on github page
and git hub action

## error handling
update the ci/cd flow to handle the when error happen on crawling

