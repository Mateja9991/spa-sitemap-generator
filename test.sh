#! /bin/bash

test_output="Opening the browser......\n
https://staging.kasta.io/\n
https://staging.kasta.io/easy-swap\n
https://staging.kasta.io/kasta-token\n
https://staging.kasta.io/kasta-token/stake\n
https://staging.kasta.io/kasta-token/tokenomics\n
https://staging.kasta.io/company\n
https://staging.kasta.io/blog\n
https://staging.kasta.io/faq\n
https://staging.kasta.io/contact\n
https://staging.kasta.io/roadmap\n
https://staging.kasta.io/referral-program\n
https://staging.kasta.io/app-privacy-policy\n
https://staging.kasta.io/privacy-policy\n
https://staging.kasta.io/easy-swap/business\n
https://staging.kasta.io/blog/crypto-referral-program\n
https://staging.kasta.io/blog/how-to-swap-btc-to-eth\n
https://staging.kasta.io/blog/how-to-swap-usdt\n
https://staging.kasta.io/blog/best-crypto-app-for-beginners\n
https://staging.kasta.io/blog/how-to-swap-ethereum\n
https://staging.kasta.io/blog/28-Popular-Crypto-Terms-and-Abbreviations-You-Should-Know\n
https://staging.kasta.io/blog/what-is-bitcoin\n
https://staging.kasta.io/blog/effortless-transition-to-crypto-based-economy\n
https://staging.kasta.io/blog/how-to-send-bitcoin\n
https://staging.kasta.io/token\n
https://staging.kasta.io/blog/how-to-swap-bitcoin-for-another-token\n
https://staging.kasta.io/blog/how-to-swap-crypto\n
https://staging.kasta.io/blog/how-to-receive-bitcoin\n
https://staging.kasta.io/blog/token-swap\n
https://staging.kasta.io/blog/how-to-send-ethereum\n
https://staging.kasta.io/blog/how-to-receive-etherum\n
https://staging.kasta.io/blog/what-is-crypto-swap\n
https://staging.kasta.io/blog/how-to-send-crypto-with-qr-code\n
32\n
Closing the browser......\n
[]\n
Generating file ./sitemap.xml...\n
File generated sucessfully.\n"



error_counter=0
iteration=0

while true
do
	echo "Starting the script..."
	output=$(node ./src/index.js https://staging.kasta.io)
	echo "Script finished..."
	if [ "$test_output" == "$output" ]; then
		error_counter=$((error_counter+1))
		echo "Modifikovane stranice\n"
		echo $output
	else
		echo "Nije modifikavno nista\n"
	fi
	iteration=$((iteration+1))
	NUM_OF_ERRORS=$error_counter
	NUM_OF_ITERATIONS=$iteration
	ERROR_PERCENT=$(bc <<< "scale=2; $error_counter/$iteration")
	echo $ERROR_PERCENT
	export NUM_OF_ERRORS
	export NUM_OF_ITERATIONS
	export ERROR_PERCENT
done
