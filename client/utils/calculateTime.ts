export const calculateTime = (
  inputDateStr: string | Date
): string | undefined => {
  // Assuming the input date string is in UTC format
  const inputDate = new Date(inputDateStr);

  // Get current date
  const currentDate = new Date();

  // Set up date formats
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "numeric",
  };
  const dateFormat: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };

  // Check if it's today, tomorrow, or more than one day ago
  if (
    inputDate.getDate() === currentDate.getDate() &&
    inputDate.getMonth() === currentDate.getMonth() &&
    inputDate.getFullYear() === currentDate.getFullYear()
  ) {
    // Today: Convert to AM/PM format
    const ampmTime = inputDate.toLocaleTimeString("en-US", timeFormat);
    return ampmTime;
  } else if (
    inputDate.getDate() === currentDate.getDate() - 1 &&
    inputDate.getMonth() === currentDate.getMonth() &&
    inputDate.getFullYear() === currentDate.getFullYear()
  ) {
    // Tomorrow: Show "Yesterday"
    return "Yesterday";
  } else if (
    Math.floor(
      (currentDate.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24)
    ) > 1 &&
    Math.floor(
      (currentDate.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24)
    ) <= 7
  ) {
    const timeDifference = Math.floor(
      (currentDate.getTime() - inputDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const targetDate = new Date();
    targetDate.setDate(currentDate.getDate() - timeDifference);

    const daysOfWeek: string[] = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const targetDay = daysOfWeek[targetDate.getDay()];
    return targetDay;
  } else {
    // More than 7 days ago: Show date in DD/MM/YYYY format
    const formattedDate = inputDate.toLocaleDateString("en-GB", dateFormat);
    return formattedDate;
  }
};
