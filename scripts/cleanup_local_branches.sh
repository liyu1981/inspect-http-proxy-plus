#!/bin/bash

# Colors
if [ -t 1 ]; then
    ncolors=$(tput colors)
    if [ -n "$ncolors" ] && [ "$ncolors" -ge 8 ]; then
        BOLD=$(tput bold)
        UNDERLINE=$(tput smul)
        NORMAL=$(tput sgr0)
        RED=$(tput setaf 1)
        GREEN=$(tput setaf 2)
        YELLOW=$(tput setaf 3)
        BLUE=$(tput setaf 4)
        CYAN=$(tput setaf 6)
        REVERSE=$(tput rev)
    fi
fi

get_branches() {
    # Get all remote branches for comparison
    local remote="origin"
    
    # Get all local branches and their details
    mapfile -t all_local < <(git for-each-ref --format='%(refname:short)	%(HEAD)	%(committerdate:relative)	%(subject)' refs/heads)
    
    # Get all remote branches
    mapfile -t all_remote < <(git branch -r --format='%(refname:short)')
    
    remote_names=()
    for rb in "${all_remote[@]}"; do
        name=${rb#$remote/}
        remote_names+=("$name")
    done

    branches=()
    for line in "${all_local[@]}"; do
        IFS=$'\t' read -r lb head date subject <<< "$line"
        
        local found=false
        for rb_name in "${remote_names[@]}"; do
            if [[ "$lb" == "$rb_name" ]]; then
                found=true
                break
            fi
        done
        
        if [ "$found" = false ]; then
            branches+=("$lb	$head	$date	$subject")
        fi
    done

    if [ ${#branches[@]} -eq 0 ]; then
        echo "${YELLOW}No local branches found that don't exist in remote '$remote'.${NORMAL}"
        return 1
    fi
    return 0
}

# Function to draw the list
draw_list() {
    local selected=$1
    local count=$2
    shift 2
    local list=("$@")

    # Get terminal width
    local width=$(tput cols)
    [ -z "$width" ] && width=80

    # Clear screen from cursor down
    tput ed

    local title=" CLEANUP LOCAL BRANCHES (Not in remote)"
    local sep="================================================================================================"
    echo "${BLUE}${BOLD}${sep:0:$width}${NORMAL}"
    echo "${BLUE}${BOLD}${title:0:$width}${NORMAL}"
    echo " ${YELLOW}Use UP/DOWN arrows to navigate, ENTER to select for deletion${NORMAL}"
    echo " ${YELLOW}Press 'r' to refresh, 'q' to quit${NORMAL}"
    echo "${BLUE}${BOLD}${sep:0:$width}${NORMAL}"
    
    local header_fmt="  %-30s %-20s %s"
    local line_fmt="  %-30s %-20s %s"
    local sel_fmt="${GREEN}${REVERSE}> %-30s %-20s %s${NORMAL}"

    local header=$(printf "$header_fmt" "BRANCH" "LAST COMMIT" "SUBJECT")
    echo "${header:0:$width}"
    local sub_sep="------------------------------------------------------------------------------------------------"
    echo "  ${sub_sep:0:$((width-2))}"

    for i in "${!list[@]}"; do
        IFS=$'\t' read -r branch head date subject <<< "${list[$i]}"
        
        local prefix="  "
        [ "$head" == "*" ] && prefix="* "
        
        local display_branch="$prefix$branch"
        local line=""
        if [ $i -eq $selected ]; then
            line=$(printf "$sel_fmt" "${display_branch:0:30}" "${date:0:20}" "$subject")
            # For selected line with colors, we can't easily truncate the resulting string including escape codes
            # but we truncated the components.
            echo "$line"
        else
            line=$(printf "$line_fmt" "${display_branch:0:30}" "${date:0:20}" "$subject")
            echo "${line:0:$width}"
        fi
    done
}

cleanup_tui() {
    tput cnorm # Show cursor
    tput rc    # Restore cursor position
    tput ed    # Clear following text
}

# Trap for unexpected exits
trap "cleanup_tui; exit" INT TERM

main() {
    # Initial fetch to be accurate
    echo "${CYAN}Fetching remote info (pruning)...${NORMAL}"
    git fetch --prune origin > /dev/null 2>&1

    while true; do
        if ! get_branches; then
            exit 0
        fi

        selected=0
        count=${#branches[@]}

        # Hide cursor
        tput civis
        
        # Clear screen and move to top to start fresh
        # This avoids issues with scrolling and tput sc/rc
        clear
        
        # Save cursor position at top
        tput sc

        # Handle input
        while true; do
            tput rc # Restore cursor to saved position
            draw_list "$selected" "$count" "${branches[@]}"

            # Read input
            read -rsn1 key
            
            # Handle escape sequences (arrows)
            if [[ "$key" == $'\e' ]]; then
                read -rsn2 -t 0.1 next_chars
                case "$next_chars" in
                    '[A') # Up arrow
                        ((selected--))
                        [ $selected -lt 0 ] && selected=$((count - 1))
                        ;;
                    '[B') # Down arrow
                        ((selected++))
                        [ $selected -ge $count ] && selected=0
                        ;;
                esac
            elif [[ "$key" == "q" ]]; then
                cleanup_tui
                echo "Exiting."
                exit 0
            elif [[ "$key" == "r" ]]; then
                echo "${CYAN}Refreshing...${NORMAL}"
                git fetch --prune origin > /dev/null 2>&1
                break # Break inner loop to refresh
            elif [[ "$key" == "" ]]; then # Enter
                IFS=$'\t' read -r branch head date subject <<< "${branches[$selected]}"
                
                cleanup_tui
                echo ""
                if [ "$head" == "*" ]; then
                    echo "${RED}Cannot delete the current branch: $branch${NORMAL}"
                else
                    echo "${YELLOW}Selected branch: $branch${NORMAL}"
                    echo "${YELLOW}Are you sure you want to delete it? (y/N)${NORMAL}"
                    read -n 1 -r confirm
                    echo ""
                    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
                        echo "${CYAN}Deleting branch '$branch'...${NORMAL}"
                        if git branch -D "$branch"; then
                            echo "${GREEN}Successfully deleted branch '$branch'.${NORMAL}"
                        else
                            echo "${RED}Failed to delete branch '$branch'.${NORMAL}"
                        fi
                    else
                        echo "Cancelled."
                    fi
                fi
                
                echo "${CYAN}Press any key to continue...${NORMAL}"
                read -rsn1
                break # Refresh list after action
            fi
        done
    done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
