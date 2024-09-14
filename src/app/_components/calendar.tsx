"use client";
export default function Calendar() {
  const startDay = new Date();
  const range = 7;
  return (
    <>
      <div className="flex w-full flex-row">
        <div className="bg-primary-foreground text-primary">
          {new Array(24).fill(0).map((_, i) => {
            return (
              <div key={i} className="relative h-16 w-14">
                <span className="absolute -top-[8px] right-1 font-mono text-xs font-thin">
                  {i !== 0 ? i + ":00" : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-auto items-start">
          <div className="relative inline-flex w-full min-w-full flex-none overflow-hidden align-top">
            <div className="">
              {new Array(24).fill(0).map((_, i) => {
                return <div key={i} className="calendar-grid-row h-16"></div>;
              })}
            </div>
            <div className="w-2 flex-none border-r"></div>
            <div className="flex-1">
              {new Array(range).fill(0).map((_, i) => {
                return (
                  <div
                    key={i}
                    className="relative block h-full w-full border-l pr-4"
                  >
                    <DisplayDayHours />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DisplayDayHours() {
  return (
    <>
      <div className="bg-primary-foreground">
        {/* {new Array(24).fill(0).map((_, i) => {
          return <div key={i} className="h-16"></div>;
        })} */}
      </div>
    </>
  );
}
